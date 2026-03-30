import type { AnkiImportResult } from "@true-recall/core/types";

export interface ImportPreview {
	totalCards: number;
	basicCards: number;
	clozeCards: number;
	reversedCards: number;
	decks: string[];
	mediaCount: number;
}

export type ImportPhase =
	| { type: "file-select" }
	| { type: "parsing" }
	| { type: "preview"; preview: ImportPreview }
	| { type: "importing" }
	| { type: "result"; result: AnkiImportResult }
	| { type: "error"; message: string; canRetry: boolean };
