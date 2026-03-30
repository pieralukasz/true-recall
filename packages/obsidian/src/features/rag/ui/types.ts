import type { RagSourceType } from "@true-recall/core/rag/rag-chunk-actions";
import type { SearchResult } from "@true-recall/core/rag/rag-search.service";

export interface GroupedSource {
	sourceId: string;
	sourceType: RagSourceType;
	displayName: string;
	headings: string[];
	chunks: SearchResult[];
	bestScore: number;
}

export interface SourceNavigationHandlers {
	onNavigateToNote: (sourceId: string, heading: string) => void;
	onNavigateToCard: (cardId: string) => void;
	onNavigateToUid: (flashcardUid: string) => void;
}
