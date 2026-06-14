/**
 * Display-order select options for the review queue.
 *
 * Single source of truth for the New card order / Review order / New-review mix
 * dropdowns. These live per-preset (see FSRSPreset.newCardOrder/reviewOrder/
 * newReviewMix) and the queue builder reads them from the resolved preset, so
 * every surface that edits them (FSRS settings tab, preset-options modal) must
 * offer the exact same option set — otherwise a value picked in one place shows
 * up blank in another. Labels are keyed off the core union types via Record so
 * adding a new order value is a compile error until a label is supplied.
 */
import type {
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
} from "@true-recall/core/types";

export interface DisplayOrderOption<T extends string> {
	value: T;
	label: string;
}

const REVIEW_ORDER_LABELS: Record<ReviewOrder, string> = {
	"due-date": "By due date",
	"due-date-random": "Due date, then random",
	random: "Random",
	"by-retrievability": "By retrievability (lowest R first)",
	"relative-overdueness": "Relative overdueness",
	"most-lapses": "Most lapses first",
	"lowest-stability": "Lowest stability",
	"order-added": "Order added",
};

const NEW_CARD_ORDER_LABELS: Record<NewCardOrder, string> = {
	random: "Random",
	"oldest-first": "Oldest first",
	"newest-first": "Newest first",
};

const NEW_REVIEW_MIX_LABELS: Record<NewReviewMix, string> = {
	"mix-with-reviews": "Mix with reviews",
	"show-after-reviews": "Show after reviews",
	"show-before-reviews": "Show before reviews",
};

function toOptions<T extends string>(
	labels: Record<T, string>,
): DisplayOrderOption<T>[] {
	return (Object.keys(labels) as T[]).map((value) => ({
		value,
		label: labels[value],
	}));
}

export const REVIEW_ORDER_OPTIONS = toOptions(REVIEW_ORDER_LABELS);
export const NEW_CARD_ORDER_OPTIONS = toOptions(NEW_CARD_ORDER_LABELS);
export const NEW_REVIEW_MIX_OPTIONS = toOptions(NEW_REVIEW_MIX_LABELS);
