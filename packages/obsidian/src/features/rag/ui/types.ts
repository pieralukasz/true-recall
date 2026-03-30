export type { GroupedSource } from "@true-recall/core/rag/rag-source-grouper";

export interface SourceNavigationHandlers {
	onNavigateToNote: (sourceId: string, heading: string) => void;
	onNavigateToCard: (cardId: string) => void;
	onNavigateToUid: (flashcardUid: string) => void;
}
