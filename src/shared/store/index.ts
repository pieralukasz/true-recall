// Main store exports

export type { AppStore } from "@shared/store/app-store";
export { createAppStore } from "@shared/store/app-store";

// Type exports
export type {
	AppState,
	AppStoreDeps,
	BadgeCounts,
	BrowserApi,
	BrowserSliceActions,
	// Browser slice
	BrowserSliceState,
	BrowserSortColumn,
	BrowserStateFilter,
	EditModeState,
	NoteHubApi,
	NoteHubSliceActions,
	// Note Hub slice
	NoteHubSliceState,
	NoteHubSortBy,
	NoteHubSortDirection,
	NoteHubStatusFilter,
	PanelApi,
	PanelSliceActions,
	// Panel slice
	PanelSliceState,
	ProcessingStatus,
	ReviewApi,
	ReviewSliceActions,
	// Review slice
	ReviewSliceState,
	SelectionMode,
	SessionPhase,
	SimulatorApi,
	SimulatorSliceActions,
	// Simulator slice
	SimulatorSliceState,
	// Helper types
	SliceCreator,
	StatsApi,
	StatsSliceActions,
	// Stats slice
	StatsSliceState,
	ViewMode,
} from "@shared/store/types";
