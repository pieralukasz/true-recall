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
	BadgeCounts,
	EditModeState,
	SessionPhase,
	// Panel slice
	PanelSliceState,
	PanelSliceActions,
	ProcessingStatus,
	ViewMode,
	SelectionMode,
	// Session slice
	SessionSliceState,
	SessionSliceActions,
	// Browser slice
	BrowserSliceState,
	BrowserSliceActions,
	// Projects slice
	ProjectsSliceState,
	ProjectsSliceActions,
	// Simulator slice
	SimulatorSliceState,
	SimulatorSliceActions,
	// Helper types
	SliceCreator,
} from "./types";
