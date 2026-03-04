import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { effect } from "@preact/signals";
import {
	allCardsArray,
	archivedSourceUids,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";

const DOT = ' <span style="opacity:0.3; margin: 0 2px">·</span> ';

export class StatusBarWidget {
	private disposer: (() => void) | null = null;

	constructor(
		private el: HTMLElement,
		private flashcardManager: FlashcardManager,
		private onClickDue: () => void,
		private getEnabled: () => boolean = () => true,
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
		const allCards = allCardsArray.value;
		const archived = archivedSourceUids.value;
		const now = new Date();
		let dueToday = 0;
		let newCount = 0;
		let learning = 0;

		for (const card of allCards) {
			if (archived.has(card.sourceUid ?? "")) continue;
			const fsrs = card.fsrs;
			if (
				fsrs.suspended ||
				(fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
			)
				continue;

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

		return { dueToday, newCount, learning };
	}

	dispose(): void {
		this.disposer?.();
		this.el.removeEventListener("click", this.onClickDue);
	}
}
