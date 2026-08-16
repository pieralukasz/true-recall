import type { Plugin } from "obsidian";

import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";

/**
 * Flushes the in-memory SQLite database to disk the moment the app goes to
 * the background. On mobile the OS freezes timers on `hidden` and may kill
 * the process without firing unload hooks, so waiting for the debounced
 * flush would lose the most recent reviews. Flushes are serialized inside
 * SqliteStoreService, so overlapping triggers are safe.
 */
export class PersistenceLifecycleGuard {
	constructor(private readonly getStore: () => SqliteStoreService | null) {}

	register(plugin: Plugin): void {
		plugin.registerDomEvent(activeDocument, "visibilitychange", () => {
			if (activeDocument.visibilityState === "hidden") this.flush();
		});
		// pagehide is the last reliable signal on iOS before suspension.
		plugin.registerDomEvent(window, "pagehide", () => this.flush());
	}

	flush(): void {
		const store = this.getStore();
		if (!store) return;
		void store.saveNow({ bestEffort: true });
	}
}
