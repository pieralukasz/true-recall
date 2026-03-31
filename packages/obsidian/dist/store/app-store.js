import { createSimulatorSlice } from "@true-recall/obsidian/features/metrics/store/simulator.slice";
import { createPanelSlice } from "@true-recall/obsidian/features/study/store/panel.slice";
import { createReviewSlice } from "@true-recall/obsidian/features/study/store/review.slice";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
export function createAppStore(deps) {
    return createStore()(subscribeWithSelector((set, get) => ({
        review: createReviewSlice(set, get, deps),
        panel: createPanelSlice(set, get, deps),
        simulator: createSimulatorSlice(set, get, deps),
    })));
}
