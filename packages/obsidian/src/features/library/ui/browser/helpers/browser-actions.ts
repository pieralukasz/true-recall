import type { Note, NoteType } from "@true-recall/core/types/note.types";

import type { Command } from "@true-recall/obsidian/commands/command.types";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import {
	MoveCardCommand,
	MoveCardsCommand,
} from "@true-recall/obsidian/commands/commands/card-move.cmd";
import { UpdateCardCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";

import type { CardEditTarget } from "../../shared/card-edit-routing";
import type { BrowserCard } from "../types";

export interface MoveTargetRequest {
	cardCount: number;
	sourceNoteName?: string;
	cardQuestion?: string;
	cardAnswer?: string;
}

export interface BrowserNotifier {
	warning(message: string): void;
	error(message: string): void;
	operationFailed(operation: string, error: unknown): void;
	/** Returns true when the error was a duplicate question and was reported. */
	duplicateQuestion(error: unknown, question: string): boolean;
	cardsMoved(count: number, targetNotePath: string): void;
	cardsDeletedWithUndo(count: number, onUndo: () => void): void;
}

/**
 * Everything the browser's card actions need from the plugin. Kept narrow so
 * the workflows can be exercised without Obsidian, modals or a database.
 */
export interface BrowserActionDeps {
	/** Writes question/answer through the manager. Throws on duplicates. */
	updateCardContent(cardId: string, question: string, answer: string): void;
	/** Runs a command through the command history (undo stack). */
	executeCommand(command: Command): Promise<void>;
	undo(): void;
	getBrowserCard(cardId: string): BrowserCard | null;
	getOrphanedCardIds(): string[];
	confirm(message: string): Promise<boolean>;
	/** Opens the move dialog; null when cancelled. */
	pickMoveTarget(request: MoveTargetRequest): Promise<string | null>;
	resolveEditTarget(cardId: string): CardEditTarget;
	/** Opens the note editor (or the image occlusion editor) and waits. */
	openEditor(cardId: string, note: Note, noteType: NoteType): Promise<void>;
	notify: BrowserNotifier;
}

export type CardField = "question" | "answer";

/**
 * Save an inline preview edit and register it for undo.
 *
 * Returns the refreshed preview card, or null when nothing was saved (image
 * occlusion card, no change, duplicate question, write error).
 */
export async function saveCardContent(
	deps: BrowserActionDeps,
	card: BrowserCard,
	value: string,
	field: CardField,
): Promise<BrowserCard | null> {
	if (card.cardType === "image-occlusion") {
		deps.notify.warning(
			"Image occlusion cards are edited in the image occlusion editor.",
		);
		return null;
	}

	// The preview holds a snapshot from when the row was opened. Base the undo
	// entry and the untouched field on the stored card, like the panel does.
	const stored = deps.getBrowserCard(card.id) ?? card;
	const previousQuestion = stored.question;
	const previousAnswer = stored.answer;
	const nextQuestion = field === "question" ? value : previousQuestion;
	const nextAnswer = field === "answer" ? value : previousAnswer;
	if (nextQuestion === previousQuestion && nextAnswer === previousAnswer) {
		return null;
	}

	try {
		deps.updateCardContent(card.id, nextQuestion, nextAnswer);
	} catch (error) {
		if (!deps.notify.duplicateQuestion(error, nextQuestion)) {
			deps.notify.operationFailed("save card", error);
		}
		return null;
	}

	await deps.executeCommand(
		new UpdateCardCommand(
			card.id,
			previousQuestion,
			previousAnswer,
			nextQuestion,
			nextAnswer,
			`Edit card ${field}`,
		),
	);

	return (
		deps.getBrowserCard(card.id) ?? {
			...card,
			question: nextQuestion,
			answer: nextAnswer,
		}
	);
}

/**
 * Confirm and delete every orphaned card as one undoable command.
 * Returns the ids that are actually gone afterwards.
 */
export async function removeOrphanedCards(
	deps: BrowserActionDeps,
): Promise<string[]> {
	const orphanedIds = deps.getOrphanedCardIds();
	if (orphanedIds.length === 0) return [];

	const cardWord = orphanedIds.length === 1 ? "card" : "cards";
	const confirmed = await deps.confirm(
		`Remove ${orphanedIds.length} orphaned ${cardWord}?`,
	);
	if (!confirmed) return [];

	const command = new DeleteCardCommand(orphanedIds);
	await deps.executeCommand(command);
	if (command.deletedCount === 0) {
		deps.notify.error("No orphaned cards were removed.");
		return [];
	}

	deps.notify.cardsDeletedWithUndo(command.deletedCount, () => deps.undo());
	return orphanedIds.filter((id) => deps.getBrowserCard(id) === null);
}

/** Move the previewed card. Returns true when the card was moved. */
export async function moveCard(
	deps: BrowserActionDeps,
	card: BrowserCard,
): Promise<boolean> {
	const target = await deps.pickMoveTarget({
		cardCount: 1,
		sourceNoteName: card.sourceNoteName ?? undefined,
		cardQuestion: card.question,
		cardAnswer: card.answer,
	});
	if (!target) return false;

	const command = new MoveCardCommand(card.id, target);
	try {
		await deps.executeCommand(command);
	} catch (error) {
		deps.notify.operationFailed("move card", error);
		return false;
	}
	if (!command.moved) {
		deps.notify.error("Card not found. It may have been deleted.");
		return false;
	}

	deps.notify.cardsMoved(1, target);
	return true;
}

/**
 * Move the selected cards as a single undo step.
 * Returns true when at least one card was moved.
 */
export async function moveCards(
	deps: BrowserActionDeps,
	cardIds: readonly string[],
): Promise<boolean> {
	if (cardIds.length === 0) return false;
	const target = await deps.pickMoveTarget({ cardCount: cardIds.length });
	if (!target) return false;

	const command = new MoveCardsCommand(cardIds, target);
	try {
		await deps.executeCommand(command);
	} catch (error) {
		deps.notify.operationFailed("move cards", error);
		return false;
	}
	if (command.movedCount === 0) {
		deps.notify.error("No cards were moved.");
		return false;
	}

	deps.notify.cardsMoved(command.movedCount, target);
	return true;
}

/**
 * Bring the open preview in line with the store after a data change (undo,
 * bulk action, edit elsewhere). Returns null when the card is gone and the
 * same object when nothing visible changed.
 *
 * Unsaved typing in the preview is safe: its editor only replaces the
 * document when the question/answer string itself changes.
 */
export function reconcilePreviewCard(
	current: BrowserCard,
	stored: BrowserCard | null,
): BrowserCard | null {
	if (!stored) return null;
	const keys = Object.keys(stored) as (keyof BrowserCard)[];
	const changed =
		keys.length !== Object.keys(current).length ||
		keys.some((key) => !isSameValue(current[key], stored[key]));
	return changed ? stored : current;
}

function isSameValue(a: unknown, b: unknown): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
	}
	return Object.is(a, b);
}

/**
 * Open the full editor for the previewed card.
 *
 * Returns the card to show afterwards: the stored version when it still
 * exists, null when it was deleted meanwhile, or the original card when the
 * editor could not be opened.
 */
export async function editCard(
	deps: BrowserActionDeps,
	card: BrowserCard,
): Promise<BrowserCard | null> {
	const target = deps.resolveEditTarget(card.id);
	if (!target.ok) {
		deps.notify.error(target.error);
		return card;
	}

	await deps.openEditor(card.id, target.note, target.noteType);

	// The editor writes straight to the store; show what was saved.
	return deps.getBrowserCard(card.id);
}
