import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import type { AppState, AppStoreDeps } from "./types";
import {
	createReviewSlice,
	createPanelSlice,
	createSessionSlice,
	createProjectsSlice,
	createSimulatorSlice,
	createStatsSlice,
	createNoteHubSlice,
	createBrowserSlice,
} from "./slices";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(deps: AppStoreDeps) {
	return createStore<AppState>()(
		subscribeWithSelector((set, get) => ({
			review: createReviewSlice(set, get, deps),
			panel: createPanelSlice(set, get, deps),
			session: createSessionSlice(set, get, deps),
			projects: createProjectsSlice(set, get, deps),
			simulator: createSimulatorSlice(set, get, deps),
			stats: createStatsSlice(set, get, deps),
			noteHub: createNoteHubSlice(set, get, deps),
			browser: createBrowserSlice(set, get, deps),
		}))
	);
}
