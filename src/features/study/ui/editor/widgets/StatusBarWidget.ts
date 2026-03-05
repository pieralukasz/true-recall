import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import type { FSRSService } from "@features/core/services/fsrs.service";
import type { HierarchyService } from "@features/core/services/hierarchy.service";
import type { PresetService } from "@features/core/services/preset.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { effect } from "@preact/signals";
import {
	allCardsArray,
	archivedSourceUids,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import type { CardStore } from "@shared/types/fsrs/store.types";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { computeProjectStats } from "./project-stats";

const DOT = ' <span style="opacity:0.3; margin: 0 2px">·</span> ';

interface StatusBarServices {
	presetService: PresetService;
	sessionPersistence: SessionPersistenceService;
	hierarchyService: HierarchyService;
	cardStore: CardStore;
	fsrsService: FSRSService;
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

		const { presetService, sessionPersistence, hierarchyService, cardStore, fsrsService } =
			this.services;

		const newStudied = sessionPersistence.getNewCardsStudiedToday();
		const reviewsCompleted = sessionPersistence.getReviewCardsCompletedToday();

		let totalNew = 0;
		let totalLearning = 0;
		let totalDue = 0;

		// Collect all project source UIDs to identify unassigned cards later
		const projectSourceUids = new Set<string>();

		// Per-project aggregation — mirrors dashboard's project-aggregation.ts
		// Only root projects: computeProjectStats already includes descendants
		const hierarchy = hierarchyService.buildHierarchy();
		for (const node of hierarchy) {
			if (hierarchyService.isProjectArchived(node.path)) continue;

			const uids = hierarchyService.getSourceUidsForProject(node.path);
			for (const uid of uids) projectSourceUids.add(uid);

			const stats = computeProjectStats(
				node.path,
				node.name,
				node.children.length,
				hierarchyService,
				cardStore,
				fsrsService,
			);

			const preset = presetService.resolvePresetChain(node.path).effective.preset;
			totalNew += Math.min(stats.newCount, Math.max(0, preset.newCardsPerDay - newStudied));
			totalLearning += stats.learning;
			totalDue += Math.min(stats.due, Math.max(0, preset.reviewsPerDay - reviewsCompleted));
		}

		// Unassigned cards (not in any project) — count from allCardsArray, cap with default preset
		const allCards = allCardsArray.value;
		const archived = archivedSourceUids.value;
		const now = new Date();
		let unNew = 0;
		let unLearning = 0;
		let unDue = 0;

		for (const card of allCards) {
			if (projectSourceUids.has(card.sourceUid ?? "")) continue;
			if (archived.has(card.sourceUid ?? "")) continue;
			const fsrs = card.fsrs;
			if (fsrs.suspended || (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)) continue;

			switch (fsrs.state) {
				case 0: unNew++; break;
				case 1: case 3: unLearning++; break;
				case 2: if (new Date(fsrs.due) <= now) unDue++; break;
			}
		}

		if (unNew > 0 || unLearning > 0 || unDue > 0) {
			const defaultPreset = presetService.getDefaultPreset();
			totalNew += Math.min(unNew, Math.max(0, defaultPreset.newCardsPerDay - newStudied));
			totalLearning += unLearning;
			totalDue += Math.min(unDue, Math.max(0, defaultPreset.reviewsPerDay - reviewsCompleted));
		}

		return { dueToday: totalDue, newCount: totalNew, learning: totalLearning };
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
