import { effect } from "@preact/signals";
import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type {
	PresetDailyProgress,
	SessionPersistenceService,
} from "@true-recall/core/persistence/session/session-persistence.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import type {
	CardSchedulingMeta,
	TrueRecallSettings,
} from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs";
import type { FSRSPreset } from "@true-recall/core/types/settings.types";
import { getDataLayer, Q } from "@true-recall/obsidian/data";
import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { State } from "ts-fsrs";

const DOT = " \u00B7 ";

interface StatusBarServices {
	presetService: PresetService;
	sessionPersistence: SessionPersistenceService;
}

interface BucketStats {
	preset: FSRSPreset;
	newRaw: number;
	learning: number;
	dueRaw: number;
}

interface CardWithPreset {
	card: FSRSFlashcardItem;
	preset: FSRSPreset;
}

export function aggregateCardsWithPresetLimits(
	cards: CardWithPreset[],
	archived: ReadonlySet<string>,
	progressByPreset: Map<string, PresetDailyProgress>,
	now: Date = new Date(),
): { dueToday: number; newCount: number; learning: number } {
	const buckets = new Map<string, BucketStats>();
	const seenCardIds = new Set<string>();

	for (const { card, preset } of cards) {
		if (seenCardIds.has(card.id)) continue;
		seenCardIds.add(card.id);
		if (!card.sourceNotePath) continue; // Keep StatusBar aligned with dashboard notes list
		if (archived.has(card.sourceUid ?? "")) continue;
		const fsrs = card.fsrs;
		if (
			fsrs.suspended ||
			(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
		) {
			continue;
		}

		let bucket = buckets.get(preset.id);
		if (!bucket) {
			bucket = { preset, newRaw: 0, learning: 0, dueRaw: 0 };
			buckets.set(preset.id, bucket);
		}

		switch (fsrs.state) {
			case State.New:
				bucket.newRaw++;
				break;
			case State.Learning:
			case State.Relearning:
				bucket.learning++;
				break;
			case State.Review:
				if (new Date(fsrs.due) <= now) bucket.dueRaw++;
				break;
		}
	}

	let totalNew = 0;
	let totalLearning = 0;
	let totalDue = 0;

	for (const bucket of buckets.values()) {
		const progress = progressByPreset.get(bucket.preset.name) ?? {
			newStudied: 0,
			reviewsCompleted: 0,
		};
		const remainingNew = Math.max(
			0,
			bucket.preset.newCardsPerDay - progress.newStudied,
		);
		const remainingReviews = Math.max(
			0,
			bucket.preset.reviewsPerDay - progress.reviewsCompleted,
		);

		totalNew += Math.min(bucket.newRaw, remainingNew);
		totalDue += Math.min(bucket.dueRaw, remainingReviews);
		totalLearning += bucket.learning;
	}

	return { dueToday: totalDue, newCount: totalNew, learning: totalLearning };
}

export class StatusBarWidget {
	private disposer: (() => void) | null = null;

	constructor(
		private el: HTMLElement,
		_flashcardManager: FlashcardManager,
		private onClickDue: () => void,
		private getEnabled: () => boolean = () => true,
		private services?: StatusBarServices,
	) {
		this.el.addClass("true-recall-status-bar");
		// eslint-disable-next-line @obsidianmd/no-direct-style-mutation -- Obsidian status bar element requires imperative styling
		this.el.style.cursor = "pointer";
		this.el.addEventListener("click", this.onClickDue);
	}

	start(): void {
		const dl = getDataLayer();
		const allMetaSig = dl.signal(Q.ALL_META);
		const settingsSig = dl.signal(Q.SETTINGS);
		const archivedSig = dl.signal(Q.ARCHIVED_UIDS);
		this.disposer = effect(() => {
			void allMetaSig?.value;
			void settingsSig?.value;
			void archivedSig?.value;
			this.render();
		});
	}

	private render(): void {
		if (!this.getEnabled()) {
			this.el.empty();
			return;
		}

		const global = this.aggregateGlobal();

		interface Part {
			text: string;
			cssVar: string;
		}
		const parts: Part[] = [];

		if (global.newCount > 0) {
			parts.push({
				text: `${global.newCount} new`,
				cssVar: FSRS_COLORS.new.cssVar,
			});
		}
		if (global.learning > 0) {
			parts.push({
				text: `${global.learning} lrn`,
				cssVar: FSRS_COLORS.learning.cssVar,
			});
		}
		if (global.dueToday > 0) {
			parts.push({
				text: `${global.dueToday} due`,
				cssVar: FSRS_COLORS.review.cssVar,
			});
		}

		this.el.empty();

		if (parts.length === 0) {
			this.el.createSpan({
				text: "\u2713 All done",
				cls: "true-recall-status-done",
			});
			return;
		}

		parts.forEach((part, i) => {
			if (i > 0) {
				this.el.createSpan({
					text: DOT,
					cls: "true-recall-status-dot",
				});
			}
			const span = this.el.createSpan({ text: part.text });
			span.style.setProperty("color", `var(${part.cssVar})`);
		});
	}

	private aggregateGlobal(): {
		dueToday: number;
		newCount: number;
		learning: number;
	} {
		if (!this.services) return this.aggregateRaw();

		const { presetService, sessionPersistence } = this.services;
		const dl = getDataLayer();
		const allMeta = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		const archived =
			dl.get<ReadonlySet<string>>(Q.ARCHIVED_UIDS) ?? new Set<string>();
		const settings = dl.get<TrueRecallSettings>(Q.SETTINGS)!;
		const allCards = allMeta
			? ([...allMeta.values()] as FSRSFlashcardItem[])
			: [];
		const snapshot = computeActionableSessionSnapshot(
			{
				allCards,
				archivedSourceUids: archived,
				settings,
				sessionPersistence,
				presetService,
			},
			{},
		);

		return {
			dueToday: snapshot.counts.due,
			newCount: snapshot.counts.new,
			learning: snapshot.counts.learning,
		};
	}

	/** Fallback when services not available */
	private aggregateRaw(): {
		dueToday: number;
		newCount: number;
		learning: number;
	} {
		const dl = getDataLayer();
		const allMeta = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		const allCards = allMeta
			? ([...allMeta.values()] as FSRSFlashcardItem[])
			: [];
		const archived =
			dl.get<ReadonlySet<string>>(Q.ARCHIVED_UIDS) ?? new Set<string>();
		const now = new Date();
		let dueToday = 0;
		let newCount = 0;
		let learning = 0;

		for (const card of allCards) {
			if (!card.sourceNotePath) continue;
			if (archived.has(card.sourceUid ?? "")) continue;
			const fsrs = card.fsrs;
			if (
				fsrs.suspended ||
				(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
			)
				continue;
			switch (fsrs.state) {
				case State.New:
					newCount++;
					break;
				case State.Learning:
				case State.Relearning:
					learning++;
					break;
				case State.Review:
					if (new Date(fsrs.due) <= now) dueToday++;
					break;
			}
		}
		return { dueToday, newCount, learning };
	}

	dispose(): void {
		this.disposer?.();
		this.el.removeEventListener("click", this.onClickDue);
	}
}
