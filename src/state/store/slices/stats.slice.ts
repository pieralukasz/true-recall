import type { AppState, AppStoreDeps, StatsSliceState, StatsSliceActions } from "../types";
import { createStaleTracking } from "../helpers/slice-helpers";

type StatsSlice = StatsSliceState & StatsSliceActions;

export function createStatsSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	deps: AppStoreDeps
): StatsSlice {
	const stale = createStaleTracking(set, get, "stats", deps.eventBus);

	return {
		...stale,
		isStale: true,
		lastRefreshed: 0,

		markFresh: (): void => {
			set((s) => ({
				stats: { ...s.stats, isStale: false, lastRefreshed: Date.now() },
			}));
		},
	};
}
