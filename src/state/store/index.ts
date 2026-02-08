// Main store exports
export { createAppStore } from "./app-store";
export type { AppStore } from "./app-store";

// Services
export { ProjectDataService } from "./services/project-data.service";
export type { ProjectStats, ProjectDataSnapshot } from "./services/project-data.service";

// Type exports
export type {
	AppState,
	AppStoreDeps,
	// Review slice
	ReviewSliceState,
	ReviewSliceActions,
	ReviewApi,
	BadgeCounts,
	EditModeState,
	SessionPhase,
	// Panel slice
	PanelSliceState,
	PanelSliceActions,
	PanelApi,
	ProcessingStatus,
	ViewMode,
	SelectionMode,
	// Session slice
	SessionSliceState,
	SessionSliceActions,
	SessionApi,
	// Projects slice
	ProjectsSliceState,
	ProjectsSliceActions,
	ProjectsApi,
	// Simulator slice
	SimulatorSliceState,
	SimulatorSliceActions,
	SimulatorApi,
	// Stats slice
	StatsSliceState,
	StatsSliceActions,
	StatsApi,
	// Note Hub slice
	NoteHubSliceState,
	NoteHubSliceActions,
	NoteHubApi,
	NoteHubStatusFilter,
	NoteHubSortBy,
	NoteHubSortDirection,
	// Helper types
	SliceCreator,
} from "./types";
