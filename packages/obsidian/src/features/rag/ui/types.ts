export interface SourceNavigationHandlers {
	onNavigateToNote: (sourceId: string, heading: string) => void;
	onNavigateToCard: (cardId: string) => void;
	onNavigateToUid: (flashcardUid: string) => void;
}
