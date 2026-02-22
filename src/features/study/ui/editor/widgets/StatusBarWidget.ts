import type { NoteStatusCacheService } from "@features/core/cache/note-status-cache.service";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { FSRSService } from "@features/core/services/fsrs.service";
import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import { effect } from "@preact/signals";
import { dataVersion, settingsVersion, track } from "@shared/services/signals";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";

export class StatusBarWidget {
	private disposer: (() => void) | null = null;
	private statsCalc: StatsCalculatorService | null = null;

	constructor(
		private el: HTMLElement,
		private noteStatusCache: NoteStatusCacheService,
		private flashcardManager: FlashcardManager,
		private fsrsService: FSRSService,
		private sessionPersistence: SessionPersistenceService,
		private onClickDue: () => void,
		private getEnabled: () => boolean = () => true,
	) {
		this.el.addClass("true-recall-status-bar");
		this.el.style.cursor = "pointer";
		this.el.addEventListener("click", this.onClickDue);
	}

	start(): void {
		this.statsCalc = new StatsCalculatorService(
			this.fsrsService,
			this.flashcardManager,
			this.sessionPersistence,
		);

		this.disposer = effect(() => {
			track(dataVersion, settingsVersion);
			this.render();
		});
	}

	private render(): void {
		if (!this.getEnabled() || !this.noteStatusCache.hasData()) {
			this.el.empty();
			return;
		}

		const today = this.statsCalc?.getTodaySummary();
		const global = this.aggregateGlobal();

		const parts: string[] = [];

		if (global.dueToday > 0) {
			parts.push(
				`<span style="color: var(${FSRS_COLORS.review.cssVar})">${global.dueToday} due</span>`,
			);
		}
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

		if (today && today.studied > 0) {
			const pct = Math.round(today.correctRate * 100);
			parts.push(`${today.studied} done`);
			if (pct > 0) {
				parts.push(`${pct}%`);
			}
		}

		if (parts.length === 0) {
			this.el.empty();
			return;
		}

		this.el.innerHTML = parts.join(
			' <span style="opacity:0.4">·</span> ',
		);
	}

	private aggregateGlobal(): {
		dueToday: number;
		newCount: number;
		learning: number;
		total: number;
	} {
		// NoteStatusCacheService doesn't expose iteration — use FlashcardManager
		const allCards = this.flashcardManager.getAllFSRSCards();
		const now = new Date();
		let dueToday = 0;
		let newCount = 0;
		let learning = 0;
		let total = 0;

		for (const card of allCards) {
			const fsrs = card.fsrs;
			if (fsrs.suspended || (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)) continue;
			total++;

			switch (fsrs.state) {
				case 0: // State.New
					newCount++;
					break;
				case 1: // State.Learning
				case 3: // State.Relearning
					learning++;
					break;
				case 2: // State.Review
					if (new Date(fsrs.due) <= now) {
						dueToday++;
					}
					break;
			}
		}

		return { dueToday, newCount, learning, total };
	}

	dispose(): void {
		this.disposer?.();
		this.el.removeEventListener("click", this.onClickDue);
	}
}
