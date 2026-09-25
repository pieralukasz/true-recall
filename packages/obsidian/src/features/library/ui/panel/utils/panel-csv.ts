import type { FlashcardItem } from "@true-recall/core/types";

const CSV_HEADER = "Question,Answer";

/** Quote a CSV field when it contains a separator, quote, or line break. */
export function escapeCsvField(value: string): string {
	if (value.includes(",") || value.includes("\n") || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/** Serialize flashcards as a two-column Question/Answer CSV. */
export function flashcardsToCsv(
	cards: ReadonlyArray<Pick<FlashcardItem, "question" | "answer">>,
): string {
	const rows = cards.map(
		(card) => `${escapeCsvField(card.question)},${escapeCsvField(card.answer)}`,
	);
	return [CSV_HEADER, ...rows].join("\n");
}

export function csvFilenameFor(basename: string | undefined): string {
	return basename ? `${basename}-flashcards.csv` : "flashcards.csv";
}
