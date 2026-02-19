import type {
	AppState,
	AppStoreDeps,
	StatsSliceActions,
	StatsSliceState,
} from "../types";

type StatsSlice = StatsSliceState & StatsSliceActions;

export function createStatsSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	_get: () => AppState,
	_deps: AppStoreDeps,
): StatsSlice {
	return {
		lastRefreshed: 0,

		setLastRefreshed: (time: number): void => {
			set((s) => ({
				stats: { ...s.stats, lastRefreshed: time },
			}));
		},
	};
}
