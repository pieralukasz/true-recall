import { createSimulatorSlice } from "@features/metrics/store/simulator.slice";
import { createPanelSlice } from "@features/study/store/panel.slice";
import { createReviewSlice } from "@features/study/store/review.slice";
import type { AppState, AppStoreDeps } from "@shared/store/types";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(deps: AppStoreDeps) {
	return createStore<AppState>()(
		subscribeWithSelector((set, get) => ({
			review: createReviewSlice(set, get, deps),
			panel: createPanelSlice(set, get, deps),
			simulator: createSimulatorSlice(set, get, deps),
		})),
	);
}
