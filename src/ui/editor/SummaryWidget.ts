// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { WidgetType } from "@codemirror/view";
import { setIcon } from "obsidian";
import type { AggregatedStats } from "./summary-helpers";
import { aggregatedStatsEqual } from "./summary-helpers";

export function createSummaryBannerElement(opts: {
	stats: AggregatedStats;
	onReviewAll: () => void;
	onReviewDue: () => void;
}): HTMLDivElement {
	const { stats, onReviewAll, onReviewDue } = opts;

	const wrapper = document.createElement("div");
	wrapper.className = "true-recall-summary-banner";

	const icon = document.createElement("span");
	icon.className = "true-recall-summary-icon";
	setIcon(icon, "zap");
	wrapper.appendChild(icon);

	const statsContainer = document.createElement("span");
	statsContainer.className = "true-recall-summary-stats";

	const newSpan = document.createElement("span");
	newSpan.className = "true-recall-summary-stat-new";
	newSpan.textContent = `${stats.new} new`;
	statsContainer.appendChild(newSpan);

	statsContainer.appendChild(createDot());

	const learningSpan = document.createElement("span");
	learningSpan.className = "true-recall-summary-stat-learning";
	learningSpan.textContent = `${stats.learning} learning`;
	statsContainer.appendChild(learningSpan);

	statsContainer.appendChild(createDot());

	const dueSpan = document.createElement("span");
	dueSpan.className = "true-recall-summary-stat-due";
	dueSpan.textContent = `${stats.dueToday} due`;
	statsContainer.appendChild(dueSpan);

	const totalSpan = document.createElement("span");
	totalSpan.className = "true-recall-summary-total";
	totalSpan.textContent = `(${stats.total})`;
	statsContainer.appendChild(totalSpan);

	wrapper.appendChild(statsContainer);

	const actions = document.createElement("span");
	actions.className = "true-recall-summary-actions";

	const btnDue = document.createElement("span");
	btnDue.className = "true-recall-summary-action";
	btnDue.setAttribute("aria-label", "Review due cards");
	btnDue.title = "Review due";
	setIcon(btnDue, "play");
	btnDue.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onReviewDue();
	});
	actions.appendChild(btnDue);

	const btnAll = document.createElement("span");
	btnAll.className = "true-recall-summary-action";
	btnAll.setAttribute("aria-label", "Review all cards");
	btnAll.title = "Review all";
	setIcon(btnAll, "layers");
	btnAll.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onReviewAll();
	});
	actions.appendChild(btnAll);

	wrapper.appendChild(actions);

	return wrapper;
}

export function createSectionSummaryElement(opts: {
	stats: AggregatedStats;
	onReview: () => void;
}): HTMLDivElement {
	const { stats, onReview } = opts;

	const wrapper = document.createElement("div");
	wrapper.className = "true-recall-section-summary";

	const newSpan = document.createElement("span");
	newSpan.className = "true-recall-summary-stat-new";
	newSpan.textContent = `${stats.new} new`;
	wrapper.appendChild(newSpan);

	wrapper.appendChild(createDot());

	const dueSpan = document.createElement("span");
	dueSpan.className = "true-recall-summary-stat-due";
	dueSpan.textContent = `${stats.dueToday} due`;
	wrapper.appendChild(dueSpan);

	const totalSpan = document.createElement("span");
	totalSpan.className = "true-recall-summary-total";
	totalSpan.textContent = `(${stats.total})`;
	wrapper.appendChild(totalSpan);

	const btn = document.createElement("span");
	btn.className = "true-recall-summary-action true-recall-summary-action-section";
	btn.setAttribute("aria-label", "Review cards in this section");
	btn.title = "Review section";
	setIcon(btn, "play");
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onReview();
	});
	wrapper.appendChild(btn);

	return wrapper;
}

function createDot(): HTMLSpanElement {
	const dot = document.createElement("span");
	dot.className = "true-recall-summary-dot";
	dot.textContent = "\u00B7";
	return dot;
}

export class SummaryBannerWidget extends WidgetType {
	constructor(
		readonly stats: AggregatedStats,
		readonly onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createSummaryBannerElement({
			stats: this.stats,
			onReviewAll: () => this.onReviewNotes(this.stats.noteNames, false),
			onReviewDue: () => this.onReviewNotes(this.stats.noteNames, true),
		});
	}

	eq(other: SummaryBannerWidget): boolean {
		return aggregatedStatsEqual(this.stats, other.stats);
	}
}

export class SectionSummaryWidget extends WidgetType {
	constructor(
		readonly stats: AggregatedStats,
		readonly onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createSectionSummaryElement({
			stats: this.stats,
			onReview: () => this.onReviewNotes(this.stats.noteNames, false),
		});
	}

	eq(other: SectionSummaryWidget): boolean {
		return aggregatedStatsEqual(this.stats, other.stats);
	}
}
