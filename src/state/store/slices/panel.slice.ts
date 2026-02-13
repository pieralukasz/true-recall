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
import { createSelectionActions, createStaleTracking, toggleSetItem } from "../helpers/slice-helpers";
import type { FlashcardEventType } from "../../../types/events.types";

type PanelSlice = PanelSliceState & PanelSliceActions;

const PANEL_STALE_EVENTS: FlashcardEventType[] = [
	"card:added",
	"card:removed",
	"card:updated",
	"card:reviewed",
	"cards:bulk-change",
	"settings:changed",
];

function createInitialState(): PanelSliceState {
	return {
		isStale: false,
		status: "none",
		viewMode: "list",
		currentFile: null,
		flashcardInfo: null,
		error: null,
		renderVersion: 0,
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
	deps: AppStoreDeps
): PanelSlice {
	const initial = createInitialState();
	const stale = createStaleTracking(set, get, "panel", deps.eventBus, PANEL_STALE_EVENTS);

	const slice: PanelSlice = {
		...initial,
		...stale,

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

		setError: (error: AppError | null) => {
			set((s) => ({
				panel: {
					...s.panel,
					error,
					status: error ? "none" : s.panel.status,
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

		setUncollectedInfo: (count: number) => {
			set((s) => ({
				panel: { ...s.panel, uncollectedCount: count },
			}));
		},

		hasUncollectedFlashcards: () => {
			return get().panel.uncollectedCount > 0;
		},

		...(() => {
			const sel = createSelectionActions(set, get, "panel", "selectionMode", "selectedCardIds");
			return {
				enterSelectionMode: sel.enterSelectionMode,
				exitSelectionMode: sel.exitSelectionMode,
				toggleCardSelection: sel.toggleSelection,
				isInSelectionMode: sel.isInSelectionMode,
			};
		})(),

		toggleCardExpanded: toggleSetItem(set, get, "panel", "expandedCardIds"),

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
