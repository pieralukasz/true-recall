import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { createBrowserSlice } from "@features/library/store/browser.slice";
import { createNoteHubSlice } from "@features/library/store/note-hub.slice";
import { createPanelSlice } from "@features/study/store/panel.slice";
import { createReviewSlice } from "@features/study/store/review.slice";
import { createSessionSlice } from "@features/study/store/session.slice";
import { createSimulatorSlice } from "@features/metrics/store/simulator.slice";
import { createStatsSlice } from "@features/metrics/store/stats.slice";
import type { AppState, AppStoreDeps } from "@shared/store/types";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(deps: AppStoreDeps) {
	return createStore<AppState>()(
		subscribeWithSelector((set, get) => ({
			review: createReviewSlice(set, get, deps),
			panel: createPanelSlice(set, get, deps),
			session: createSessionSlice(set, get, deps),
			simulator: createSimulatorSlice(set, get, deps),
			stats: createStatsSlice(set, get, deps),
			noteHub: createNoteHubSlice(set, get, deps),
			browser: createBrowserSlice(set, get, deps),
		})),
	);
}
