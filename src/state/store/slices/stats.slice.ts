import type { AppState, AppStoreDeps } from "../types";
import type { FlashcardEventType } from "../../../types/events.types";

export interface StatsSliceState {
	isStale: boolean;
	lastRefreshed: number;
}

export interface StatsSliceActions {
	markStale: () => void;
	markFresh: () => void;
	getIsStale: () => boolean;
}

export type StatsApi = StatsSliceState & StatsSliceActions;

type StatsSlice = StatsSliceState & StatsSliceActions;

export function createStatsSlice(
	set: (fn: (state: AppState) => Partial<AppState>) => void,
	get: () => AppState,
	deps: AppStoreDeps
): StatsSlice {
	const eventBus = deps.eventBus;

	const markStale = (): void => {
		set((s) => ({
			stats: { ...s.stats, isStale: true },
		}));
	};

	// Auto-invalidate stats on card events
	const invalidatingEvents: FlashcardEventType[] = [
		"card:added",
		"card:removed",
		"card:updated",
		"card:reviewed",
		"cards:bulk-change",
	];

	for (const eventType of invalidatingEvents) {
		eventBus.on(eventType, markStale);
	}

	return {
		// State
		isStale: true,
		lastRefreshed: 0,

		// Actions
		markStale,

		markFresh: (): void => {
			set((s) => ({
				stats: { ...s.stats, isStale: false, lastRefreshed: Date.now() },
			}));
		},

		getIsStale: (): boolean => get().stats.isStale,
	};
}
