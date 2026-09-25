import { Rating } from "ts-fsrs";

import {
	LEECH_TAG,
	withLeechTag,
} from "@true-recall/core/helpers/leech-helpers";
import type {
	CardSchedulingMeta,
	FSRSCardData,
	FSRSFlashcardItem,
} from "@true-recall/core/types";

import {
	mutateReviewGrade,
	patchCardDues,
	patchNoteTags,
} from "@true-recall/obsidian/data";
import { reportError } from "@true-recall/obsidian/services/errors";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type { Command, CommandContext } from "../command.types";

interface SiblingDueChange {
	cardId: string;
	originalDue: string;
	newDue: string;
}

interface ReviewAnswerParams {
	card: FSRSFlashcardItem;
	originalFsrs: FSRSCardData;
	updatedFsrs: FSRSCardData;
	previousIndex: number | null;
	wasNewCard: boolean;
	rating: number;
	previousState: number;
	scheduledDays: number;
	elapsedDays: number;
	responseTime: number;
	presetName: string;
	requeuedAtIndex?: number;
	buriedSiblings?: FSRSFlashcardItem[];
	/** Add the leech tag to the card's note in the same write as the answer. */
	addLeechTag?: boolean;
	/**
	 * Runs inside the answer's transaction, after the card is saved, and
	 * returns the sibling due changes it wrote (automatic sibling dispersal).
	 * Undo puts those siblings back.
	 */
	disperseSiblings?: () => SiblingDueChange[];
	skipNotification?: boolean;
	getReview?: () => ReviewApi;
	onPersisted?: () => void;
}

export class ReviewAnswerCommand implements Command {
	readonly type = "review:answer";
	readonly mutationType = "card:reviewed" as const;
	readonly deferred = true;
	readonly description: string;

	readonly params: ReviewAnswerParams;
	private writeExecuted = false;
	private writePersisted = false;
	private pendingTimeoutId: number | null = null;
	private reviewLogId: string | null = null;
	private deferredFailureHandler?: () => void;
	private sessionRestored = false;
	/** Set when execute() actually added the leech tag, so undo only removes its own write. */
	private leechTagWrite: { noteId: string; tags: string[] } | null = null;
	private siblingDueChanges: SiblingDueChange[] = [];

	constructor(params: ReviewAnswerParams) {
		this.description = `Review (${Rating[params.rating]})`;
		this.params = params;
	}

	onDeferredFailure(handler: () => void): void {
		this.deferredFailureHandler = handler;
	}

	execute(ctx: CommandContext): void {
		this.pendingTimeoutId = window.setTimeout(() => {
			this.writeExecuted = true;
			this.pendingTimeoutId = null;

			const p = this.params;
			try {
				ctx.cardStore.transaction(() => {
					const persisted = ctx.flashcardManager.updateCardFSRS(
						p.card.id,
						p.updatedFsrs,
						undefined,
						{ skipNotification: true },
					);
					if (!persisted) throw new Error("Reviewed card no longer exists");
					this.leechTagWrite = p.addLeechTag
						? addLeechTagToNote(ctx, p.card.noteId)
						: null;
					this.siblingDueChanges = p.disperseSiblings?.() ?? [];
					this.reviewLogId = ctx.sessionPersistence.recordReview(
						p.card.id,
						p.wasNewCard,
						p.responseTime,
						p.rating,
						p.previousState,
						p.scheduledDays,
						p.elapsedDays,
						p.presetName,
					);
				});
				this.writePersisted = true;
			} catch (error) {
				this.leechTagWrite = null;
				this.siblingDueChanges = [];
				this.restoreSessionState();
				this.deferredFailureHandler?.();
				reportError(error, {
					origin: "review-persistence",
					context: { operation: "record-answer" },
				});
				notify().operationFailed("save review answer", error);
				return;
			}
			try {
				p.onPersisted?.();
			} catch (error) {
				reportError(error, {
					origin: "review-post-commit",
					context: { operation: "update-temporary-deck" },
				});
				notify().operationFailed("update Custom Study Session", error);
			}

			mutateReviewGrade(
				p.card.id,
				() => {},
				() =>
					buildMetaFromCard(
						p.card,
						p.updatedFsrs,
						this.leechTagWrite?.tags ?? p.card.tags,
					),
			);
			if (this.leechTagWrite) {
				patchNoteTags(this.leechTagWrite.noteId, this.leechTagWrite.tags);
			}
			if (this.siblingDueChanges.length > 0) {
				patchCardDues(
					this.siblingDueChanges.map((c) => ({
						cardId: c.cardId,
						due: c.newDue,
					})),
				);
			}
		}, 0);
	}

	restoreSessionState(): void {
		const p = this.params;
		if (this.sessionRestored || p.previousIndex === null || !p.getReview)
			return;
		this.sessionRestored = true;
		const review = p.getReview();
		for (const sibling of p.buriedSiblings ?? []) {
			review.insertCardAtPosition(sibling, review.queue.length);
		}
		review.undoLastAnswer(
			p.previousIndex,
			{ ...p.card, fsrs: p.originalFsrs },
			p.requeuedAtIndex,
		);
	}

	cancelPendingWrite(): boolean {
		if (!this.writeExecuted && this.pendingTimeoutId !== null) {
			window.clearTimeout(this.pendingTimeoutId);
			this.pendingTimeoutId = null;
			return true;
		}
		return false;
	}

	undo(ctx: CommandContext): void {
		const cancelled = this.cancelPendingWrite();
		const p = this.params;

		// A fired-but-failed write (card deleted between answer and the
		// deferred write) recorded nothing — undoing it would decrement
		// today's stats for a review that never landed.
		if (!cancelled && this.writePersisted) {
			// skipNotification matches execute() — without it, card:updated
			// fires through the bus, sets lastMutation, and the ReviewView
			// effect runs rebuildActiveSession against stale Q.ALL_META,
			// clobbering the queue that ReviewUndoHook.undoAnswer just
			// restored (manifested as "20 → good → 19 → undo → 21").
			ctx.flashcardManager.updateCardFSRS(
				p.card.id,
				p.originalFsrs,
				undefined,
				{ skipNotification: true },
			);
			ctx.sessionPersistence.removeLastReview(
				p.card.id,
				p.wasNewCard,
				p.rating,
				p.previousState,
				this.reviewLogId,
			);
			if (this.siblingDueChanges.length > 0) {
				for (const change of this.siblingDueChanges) {
					ctx.cardStore.cards.updateCardDue(change.cardId, change.originalDue);
				}
				patchCardDues(
					this.siblingDueChanges.map((c) => ({
						cardId: c.cardId,
						due: c.originalDue,
					})),
				);
				this.siblingDueChanges = [];
			}
			const restoredTags = this.leechTagWrite
				? removeLeechTagFromNote(ctx, this.leechTagWrite.noteId)
				: null;
			this.leechTagWrite = null;
			mutateReviewGrade(
				p.card.id,
				() => {},
				() =>
					buildMetaFromCard(
						p.card,
						p.originalFsrs,
						restoredTags ?? p.card.tags,
					),
			);
			if (restoredTags && p.card.noteId) {
				patchNoteTags(p.card.noteId, restoredTags);
			}
		}
	}
}

/** Reads tags from the DB (not the in-memory card) so other note tags survive. */
function addLeechTagToNote(
	ctx: CommandContext,
	noteId: string | undefined,
): { noteId: string; tags: string[] } | null {
	if (!noteId) return null;
	const note = ctx.cardStore.notes.getById(noteId);
	if (!note || note.tags.includes(LEECH_TAG)) return null;
	const tags = withLeechTag(note.tags);
	ctx.cardStore.notes.update(noteId, { tags }, "system");
	return { noteId, tags };
}

function removeLeechTagFromNote(
	ctx: CommandContext,
	noteId: string,
): string[] | null {
	const note = ctx.cardStore.notes.getById(noteId);
	if (!note) return null;
	const tags = note.tags.filter((tag) => tag !== LEECH_TAG);
	ctx.cardStore.notes.update(noteId, { tags }, "system");
	return tags;
}

function buildMetaFromCard(
	card: FSRSFlashcardItem,
	fsrs: FSRSCardData,
	tags: string[] | undefined = card.tags,
): CardSchedulingMeta {
	return {
		id: card.id,
		fsrs,
		sourceUid: card.sourceUid,
		sourceNoteName: card.sourceNoteName,
		sourceNotePath: card.sourceNotePath,
		cardType: card.cardType,
		noteId: card.noteId,
		templateOrd: card.templateOrd,
		noteTypeName: card.noteTypeName,
		alwaysTypeIn: card.alwaysTypeIn,
		tags,
	};
}
