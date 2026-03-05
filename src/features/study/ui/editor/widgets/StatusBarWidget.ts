import type {
	PresetDailyProgress,
	SessionPersistenceService,
} from "@features/core/persistence/session-persistence.service";
import type { PresetService } from "@features/core/services/preset.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { effect } from "@preact/signals";
import {
	allCardsArray,
	archivedSourceUids,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import type { FSRSFlashcardItem } from "@shared/types/fsrs";
import type { FSRSPreset } from "@shared/types/settings.types";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";

const DOT = ' <span style="opacity:0.3; margin: 0 2px">·</span> ';

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
		if (fsrs.suspended || (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)) {
			continue;
		}

		let bucket = buckets.get(preset.id);
		if (!bucket) {
			bucket = { preset, newRaw: 0, learning: 0, dueRaw: 0 };
			buckets.set(preset.id, bucket);
		}

		switch (fsrs.state) {
			case 0:
				bucket.newRaw++;
				break;
			case 1:
			case 3:
				bucket.learning++;
				break;
			case 2:
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
		private flashcardManager: FlashcardManager,
		private onClickDue: () => void,
		private getEnabled: () => boolean = () => true,
		private services?: StatusBarServices,
	) {
		this.el.addClass("true-recall-status-bar");
		this.el.style.cursor = "pointer";
		this.el.addEventListener("click", this.onClickDue);
	}

	start(): void {
		this.disposer = effect(() => {
			allCardsArray.value;
			pluginSettings.value;
			archivedSourceUids.value;
			this.render();
		});
	}

	private render(): void {
		if (!this.getEnabled()) {
			this.el.empty();
			return;
		}

		const global = this.aggregateGlobal();
		const parts: string[] = [];

		if (global.newCount > 0) {
			parts.push(
				`<span style="color: var(${FSRS_COLORS.new.cssVar})">${global.newCount} new</span>`,
			);
		}
		if (global.learning > 0) {
			parts.push(
				`<span style="color: var(${FSRS_COLORS.learning.cssVar})">${global.learning} lrn</span>`,
			);
		}
		if (global.dueToday > 0) {
			parts.push(
				`<span style="color: var(${FSRS_COLORS.review.cssVar})">${global.dueToday} due</span>`,
			);
		}

		if (parts.length === 0) {
			this.el.innerHTML = '<span style="opacity:0.5">✓ All done</span>';
			return;
		}

		this.el.innerHTML = parts.join(DOT);
	}

	private aggregateGlobal(): {
		dueToday: number;
		newCount: number;
		learning: number;
	} {
		if (!this.services) return this.aggregateRaw();

		const { presetService, sessionPersistence } = this.services;
		const archived = archivedSourceUids.value;
		const progressByPreset = sessionPersistence.getTodayProgressByPreset();
		const cardsWithPresets: CardWithPreset[] = allCardsArray.value.map((card) => {
			let preset: FSRSPreset;
			try {
				preset = presetService.resolvePresetForCard(card);
			} catch {
				preset = presetService.getDefaultPreset();
			}
			return { card, preset };
		});

		return aggregateCardsWithPresetLimits(
			cardsWithPresets,
			archived,
			progressByPreset,
		);
	}

	/** Fallback when services not available */
	private aggregateRaw(): { dueToday: number; newCount: number; learning: number } {
		const allCards = allCardsArray.value;
		const archived = archivedSourceUids.value;
		const now = new Date();
		let dueToday = 0;
		let newCount = 0;
		let learning = 0;

		for (const card of allCards) {
			if (!card.sourceNotePath) continue;
			if (archived.has(card.sourceUid ?? "")) continue;
			const fsrs = card.fsrs;
			if (fsrs.suspended || (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)) continue;
			switch (fsrs.state) {
				case 0: newCount++; break;
				case 1: case 3: learning++; break;
				case 2: if (new Date(fsrs.due) <= now) dueToday++; break;
			}
		}
		return { dueToday, newCount, learning };
	}

	dispose(): void {
		this.disposer?.();
		this.el.removeEventListener("click", this.onClickDue);
	}
}
