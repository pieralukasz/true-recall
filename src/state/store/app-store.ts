import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import type { AppState, AppStoreDeps } from "./types";
import {
	createReviewSlice,
	createPanelSlice,
	createSessionSlice,
	createBrowserSlice,
	createProjectsSlice,
	createSimulatorSlice,
} from "./slices";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(deps: AppStoreDeps) {
	return createStore<AppState>()(
		subscribeWithSelector((set, get) => ({
			review: createReviewSlice(set, get, deps),
			panel: createPanelSlice(set, get, deps),
			session: createSessionSlice(set, get, deps),
			browser: createBrowserSlice(set, get, deps),
			projects: createProjectsSlice(set, get, deps),
			simulator: createSimulatorSlice(set, get, deps),
		}))
	);
}
