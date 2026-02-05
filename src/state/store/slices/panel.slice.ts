import type { TFile } from "obsidian";
import type {
	AppState,
	AppStoreDeps,
	PanelSliceState,
	PanelSliceActions,
	ProcessingStatus,
	ViewMode,
} from "../types";
import type { FlashcardInfo } from "../../../types";
import type { AppError } from "../../../errors";

type PanelSlice = PanelSliceState & PanelSliceActions;

function createInitialState(): PanelSliceState {
	return {
		status: "none",
		viewMode: "list",
		currentFile: null,
		flashcardInfo: null,
		userInstructions: "",
		isFlashcardFile: false,
		noteFlashcardType: "unknown",
		error: null,
		renderVersion: 0,
		selectedText: "",
		hasSelection: false,
		sourceNoteName: null,
		uncollectedCount: 0,
		selectionMode: "normal",
		selectedCardIds: new Set(),
		expandedCardIds: new Set(),
		searchQuery: "",
		isAddCardExpanded: false,
		isFollowingReview: false,
		reviewSourceNotePath: null,
	};
}

export function createPanelSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	_deps: AppStoreDeps
): PanelSlice {
	const initial = createInitialState();

	const slice: PanelSlice = {
		...initial,

		setState: (partial: Partial<PanelSliceState>) => {
			set((s) => ({
				panel: { ...s.panel, ...partial },
			}));
		},

		reset: () => {
			set((s) => ({
				panel: { ...s.panel, ...createInitialState() },
			}));
		},

		incrementRenderVersion: () => {
			const newVersion = get().panel.renderVersion + 1;
			set((s) => ({
				panel: { ...s.panel, renderVersion: newVersion },
			}));
			return newVersion;
		},

		isCurrentRender: (version: number) => {
			return get().panel.renderVersion === version;
		},

		setCurrentFile: (file: TFile | null) => {
			set((s) => ({
				panel: {
					...s.panel,
					currentFile: file,
					status: "none",
					viewMode: "list",
					flashcardInfo: null,
					isFlashcardFile: false,
					noteFlashcardType: "unknown",
					error: null,
				},
			}));
		},

		setStatus: (status: ProcessingStatus) => {
			set((s) => ({
				panel: { ...s.panel, status },
			}));
		},

		setViewMode: (mode: ViewMode) => {
			set((s) => ({
				panel: { ...s.panel, viewMode: mode },
			}));
		},

		setFlashcardInfo: (info: FlashcardInfo | null) => {
			set((s) => ({
				panel: {
					...s.panel,
					flashcardInfo: info,
					status: info?.exists ? "exists" : "none",
				},
			}));
		},

		setUserInstructions: (instructions: string) => {
			set((s) => ({
				panel: { ...s.panel, userInstructions: instructions },
			}));
		},

		setError: (error: AppError | null) => {
			set((s) => ({
				panel: {
					...s.panel,
					error,
					status: error ? "none" : s.panel.status,
				},
			}));
		},

		startProcessing: () => {
			set((s) => ({
				panel: {
					...s.panel,
					status: "processing",
					error: null,
				},
			}));
		},

		finishProcessing: (hasFlashcards = false) => {
			set((s) => ({
				panel: {
					...s.panel,
					status: hasFlashcards ? "exists" : "none",
				},
			}));
		},

		isCurrentFile: (file: TFile | null) => {
			const currentFile = get().panel.currentFile;
			if (!file || !currentFile) {
				return file === currentFile;
			}
			return currentFile.path === file.path;
		},

		isProcessing: () => {
			return get().panel.status === "processing";
		},

		setSelectedText: (text: string) => {
			set((s) => ({
				panel: {
					...s.panel,
					selectedText: text,
					hasSelection: text.length > 0,
				},
			}));
		},

		clearSelection: () => {
			set((s) => ({
				panel: {
					...s.panel,
					selectedText: "",
					hasSelection: false,
				},
			}));
		},

		setUncollectedInfo: (count: number) => {
			set((s) => ({
				panel: { ...s.panel, uncollectedCount: count },
			}));
		},

		hasUncollectedFlashcards: () => {
			return get().panel.uncollectedCount > 0;
		},

		enterSelectionMode: (initialCardId?: string) => {
			const selectedCardIds = new Set<string>();
			if (initialCardId) {
				selectedCardIds.add(initialCardId);
			}
			set((s) => ({
				panel: {
					...s.panel,
					selectionMode: "selecting",
					selectedCardIds,
				},
			}));
		},

		exitSelectionMode: () => {
			set((s) => ({
				panel: {
					...s.panel,
					selectionMode: "normal",
					selectedCardIds: new Set(),
				},
			}));
		},

		toggleCardSelection: (cardId: string) => {
			const newSet = new Set(get().panel.selectedCardIds);
			if (newSet.has(cardId)) {
				newSet.delete(cardId);
			} else {
				newSet.add(cardId);
			}
			set((s) => ({
				panel: { ...s.panel, selectedCardIds: newSet },
			}));
		},

		toggleCardExpanded: (cardId: string) => {
			const newSet = new Set(get().panel.expandedCardIds);
			if (newSet.has(cardId)) {
				newSet.delete(cardId);
			} else {
				newSet.add(cardId);
			}
			set((s) => ({
				panel: { ...s.panel, expandedCardIds: newSet },
			}));
		},

		isInSelectionMode: () => {
			return get().panel.selectionMode === "selecting";
		},

		setSearchQuery: (query: string) => {
			set((s) => ({
				panel: { ...s.panel, searchQuery: query },
			}));
		},

		setAddCardExpanded: (expanded: boolean) => {
			set((s) => ({
				panel: { ...s.panel, isAddCardExpanded: expanded },
			}));
		},

		setReviewFollowState: (sourcePath: string | null, isActive: boolean) => {
			set((s) => ({
				panel: {
					...s.panel,
					isFollowingReview: isActive && sourcePath !== null,
					reviewSourceNotePath: isActive ? sourcePath : null,
				},
			}));
		},
	};

	return slice;
}
