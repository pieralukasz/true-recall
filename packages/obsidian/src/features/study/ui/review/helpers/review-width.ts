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

const INK_EMBED_PATTERN =
	/(?:!\[Ink(?:Drawing|Writing)\]|[?&]type=ink(?:Drawing|Writing)\b)/i;

function hasInkEmbed(content: string | undefined): boolean {
	return !!content && INK_EMBED_PATTERN.test(content);
}

/** Width of the card's content column: the setting, or full width on phones
 * and for handwriting embeds. The under-card panel uses it too, so its edges
 * line up with the card text above. */
export function getCardColumnMaxWidth(
	card: { question?: string; answer?: string },
	value: ReviewContentWidth,
	mobile: boolean,
): string {
	return mobile || hasInkEmbed(card.question) || hasInkEmbed(card.answer)
		? "100%"
		: getReviewMaxWidth(value);
}
