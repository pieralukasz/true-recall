import type { RagSourceType } from "../persistence/rag-chunk-actions";
import type { SearchResult } from "../services/rag-search.service";

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
