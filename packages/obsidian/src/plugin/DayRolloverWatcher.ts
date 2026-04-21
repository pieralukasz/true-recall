import type { Plugin } from "obsidian";

import type { DayBoundaryService } from "@true-recall/core/services/review/day-boundary.service";

import { type DataLayer, G } from "@true-recall/obsidian/data";

const ROLLOVER_GROUPS = [G.CARDS, G.DASHBOARD, G.PANEL, G.REVIEW, G.STATS];

/**
 * Long-lived reactive widgets (status bar, dashboard panel, etc.) only
 * re-render when DataLayer signals fire. Daily-progress and due counts depend
 * on the current day key (which rolls over at dayStartHour) — but no SQL
 * change happens at the rollover moment, so without an external trigger those
 * widgets keep showing yesterday's residual budget until the next mutation.
 *
 * This watcher fires invalidation when the user returns to the window after
 * the day key has rolled over (focus or tab becoming visible). Robust to
 * sleep/wake, since wall-clock time is consulted on each user interaction.
 */
export class DayRolloverWatcher {
	private lastDayKey: string;

	constructor(
		private readonly dayBoundaryService: DayBoundaryService,
		private readonly dataLayer: DataLayer,
	) {
		this.lastDayKey = this.dayBoundaryService.getTodayKey();
	}

	register(plugin: Plugin): void {
		plugin.registerDomEvent(window, "focus", () => this.check());
		plugin.registerDomEvent(document, "visibilitychange", () => {
			if (document.visibilityState === "visible") this.check();
		});
	}

	check(now?: Date): void {
		const currentKey = this.dayBoundaryService.getTodayKey(now);
		if (currentKey === this.lastDayKey) return;
		this.lastDayKey = currentKey;
		this.dataLayer.invalidateGroups(ROLLOVER_GROUPS);
	}
}
