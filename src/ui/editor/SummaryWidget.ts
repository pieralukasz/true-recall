// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { WidgetType } from "@codemirror/view";
import { setIcon } from "obsidian";
import type { AggregatedStats } from "./summary-helpers";
import { aggregatedStatsEqual } from "./summary-helpers";

function createPill(label: string, count: number, variant: string): HTMLSpanElement {
	const pill = document.createElement("span");
	pill.className = `true-recall-pill true-recall-pill-${variant}`;
	pill.textContent = `${count} ${label}`;
	return pill;
}

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

	statsContainer.appendChild(createPill("new", stats.new, "new"));
	statsContainer.appendChild(createPill("learning", stats.learning, "learning"));
	statsContainer.appendChild(createPill("due", stats.dueToday, "due"));

	wrapper.appendChild(statsContainer);

	const totalPill = document.createElement("span");
	totalPill.className = "true-recall-pill true-recall-pill-total";
	totalPill.textContent = `${stats.total} total`;
	wrapper.appendChild(totalPill);

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

	wrapper.appendChild(createPill("new", stats.new, "new"));
	wrapper.appendChild(createPill("due", stats.dueToday, "due"));

	const totalPill = document.createElement("span");
	totalPill.className = "true-recall-pill true-recall-pill-total";
	totalPill.textContent = `${stats.total} total`;
	wrapper.appendChild(totalPill);

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
