import type { SearchResult } from "@features/rag/services/rag-search.service";

export interface GroupedSource {
	sourceId: string;
	sourceType: "note" | "flashcard";
	displayName: string;
	headings: string[];
	chunks: SearchResult[];
	bestScore: number;
}

export interface SourceNavigationHandlers {
	onNavigateToNote: (sourceId: string, heading: string) => void;
	onNavigateToCard: (cardId: string) => void;
}
