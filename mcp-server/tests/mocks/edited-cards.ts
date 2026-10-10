export type EditedCard = {
	id: string;
	question: string;
	answer: string;
	cardType: string;
	sourceUid: string | null;
	editCount: number;
	aiEditCount: number;
	contentEditedAt: number | null;
};

/** Defaults: basic Q/A card, no source, one manual edit at 2026-10-10T10:00Z. */
export function createMockEditedCard(
	overrides: Partial<EditedCard> = {},
): EditedCard {
	return {
		id: "card-a",
		question: "Current question",
		answer: "Current answer",
		cardType: "basic",
		sourceUid: null,
		editCount: 1,
		aiEditCount: 0,
		contentEditedAt: Date.parse("2026-10-10T10:00:00Z"),
		...overrides,
	};
}
