import type { RagSourceType } from "@features/rag/persistence/rag-chunk-actions";
import type { SearchResult } from "@features/rag/services/rag-search.service";

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
}
