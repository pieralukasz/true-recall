import type { ReviewContentWidth } from "@true-recall/core/types";

const REVIEW_WIDTH_MAP: Record<ReviewContentWidth, string> = {
	narrow: "40rem",
	default: "48rem",
	wide: "64rem",
	full: "100%",
};

export function getReviewMaxWidth(value: ReviewContentWidth): string {
	return REVIEW_WIDTH_MAP[value] ?? REVIEW_WIDTH_MAP.default;
}
