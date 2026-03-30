import { createSimulatorSlice } from "@true-recall/obsidian/features/metrics/store/simulator.slice";
import { createPanelSlice } from "@true-recall/obsidian/features/study/store/panel.slice";
import { createReviewSlice } from "@true-recall/obsidian/features/study/store/review.slice";
import type { AppState, AppStoreDeps } from "@true-recall/obsidian/store/types";
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
