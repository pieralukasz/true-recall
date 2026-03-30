/**
 * QueryRuntime — single reactive query cache for the Obsidian UI layer.
 *
 * SQL is the canonical source of truth. This runtime:
 *  - caches query results by key
 *  - invalidates selectively after mutations
 *  - supports patching single entries without full refetch
 *  - exposes Preact signals for view reactivity
 *
 * Design:
 *  - Queries are registered with a loader function
 *  - Results are cached as Preact signals (auto-track in components)
 *  - Invalidation marks a query stale → next read triggers reload
 *  - Patch allows updating a single card without refetching 30k cards
 */

import { signal, type ReadonlySignal } from "@preact/signals";

// ── Types ───────────────────────────────────────────────────

export type QueryKey = string;
export type QueryGroup = string;

export interface QueryEntry<T = unknown> {
	/** Current cached value (Preact signal for auto-tracking) */
	value: ReadonlySignal<T>;
	/** Whether the cache is stale and needs reload on next read */
	stale: boolean;
	/** Loader function to fetch fresh data */
	loader: () => T;
	/** Query group(s) for bulk invalidation */
	groups: QueryGroup[];
}

export interface QueryRegistration<T> {
	key: QueryKey;
	loader: () => T;
	groups?: QueryGroup[];
}

// ── QueryRuntime ────────────────────────────────────────────

export class QueryRuntime {
	private queries = new Map<QueryKey, QueryEntry>();
	private listeners = new Map<QueryKey, Set<() => void>>();
	private disposed = false;

	/**
	 * Register a query. The loader runs immediately to populate initial cache.
	 * Returns the signal holding the cached result.
	 */
	register<T>(reg: QueryRegistration<T>): ReadonlySignal<T> {
		const existing = this.queries.get(reg.key);
		if (existing) return existing.value as ReadonlySignal<T>;

		const initialValue = reg.loader();
		const sig = signal<T>(initialValue);

		const entry: QueryEntry<T> = {
			value: sig,
			stale: false,
			loader: reg.loader,
			groups: reg.groups ?? [],
		};

		this.queries.set(reg.key, entry as QueryEntry);
		return sig;
	}

	/**
	 * Get the current cached value. If stale, reloads first.
	 */
	get<T>(key: QueryKey): T | undefined {
		const entry = this.queries.get(key) as QueryEntry<T> | undefined;
		if (!entry) return undefined;

		if (entry.stale) {
			this.reload(key);
		}

		return entry.value.value;
	}

	/**
	 * Get the signal for a query (for use in Preact components).
	 * Returns undefined if query not registered.
	 */
	signal<T>(key: QueryKey): ReadonlySignal<T> | undefined {
		const entry = this.queries.get(key);
		return entry?.value as ReadonlySignal<T> | undefined;
	}

	/**
	 * Force reload a specific query from its loader.
	 */
	reload(key: QueryKey): void {
		const entry = this.queries.get(key);
		if (!entry) return;

		try {
			const fresh = entry.loader();
			(entry.value as { value: unknown }).value = fresh;
			entry.stale = false;
			this.notifyListeners(key);
		} catch (e) {
			console.error(`[QueryRuntime] reload "${key}" failed:`, e);
		}
	}

	/**
	 * Mark a query as stale. It will reload on next access or can be
	 * eagerly reloaded with reload().
	 */
	invalidate(key: QueryKey): void {
		const entry = this.queries.get(key);
		if (!entry) return;
		entry.stale = true;
	}

	/**
	 * Invalidate and immediately reload a query.
	 */
	invalidateAndReload(key: QueryKey): void {
		this.invalidate(key);
		this.reload(key);
	}

	/**
	 * Invalidate all queries in a group, then reload them.
	 */
	invalidateGroup(group: QueryGroup): void {
		for (const [key, entry] of this.queries) {
			if (entry.groups.includes(group)) {
				entry.stale = true;
				this.reload(key);
			}
		}
	}

	/**
	 * Invalidate multiple groups at once.
	 */
	invalidateGroups(groups: QueryGroup[]): void {
		const keysToReload = new Set<QueryKey>();

		for (const [key, entry] of this.queries) {
			for (const g of groups) {
				if (entry.groups.includes(g)) {
					entry.stale = true;
					keysToReload.add(key);
					break;
				}
			}
		}

		for (const key of keysToReload) {
			this.reload(key);
		}
	}

	/**
	 * Patch a query's cached value without full reload.
	 * Use for hot paths like review grade where refetching 30k cards is too slow.
	 *
	 * The patcher receives the current value and returns the patched value.
	 * If it returns undefined, the query is invalidated and reloaded instead.
	 */
	patch<T>(key: QueryKey, patcher: (current: T) => T | undefined): void {
		const entry = this.queries.get(key) as QueryEntry<T> | undefined;
		if (!entry) return;

		const patched = patcher(entry.value.value);
		if (patched === undefined) {
			// Patcher couldn't apply — fall back to full reload
			this.invalidateAndReload(key);
			return;
		}

		(entry.value as { value: T }).value = patched;
		entry.stale = false;
		this.notifyListeners(key);
	}

	/**
	 * Subscribe to changes on a specific query key.
	 * Returns a disposer function.
	 */
	subscribe(key: QueryKey, listener: () => void): () => void {
		let set = this.listeners.get(key);
		if (!set) {
			set = new Set();
			this.listeners.set(key, set);
		}
		set.add(listener);

		return () => {
			set!.delete(listener);
			if (set!.size === 0) this.listeners.delete(key);
		};
	}

	/**
	 * Check if a query exists.
	 */
	has(key: QueryKey): boolean {
		return this.queries.has(key);
	}

	/**
	 * Remove a query and its listeners.
	 */
	unregister(key: QueryKey): void {
		this.queries.delete(key);
		this.listeners.delete(key);
	}

	/**
	 * Dispose the runtime and clear all queries.
	 */
	dispose(): void {
		this.disposed = true;
		this.queries.clear();
		this.listeners.clear();
	}

	private notifyListeners(key: QueryKey): void {
		const set = this.listeners.get(key);
		if (!set) return;
		for (const fn of set) {
			try {
				fn();
			} catch (e) {
				console.error(`[QueryRuntime] listener for "${key}" threw:`, e);
			}
		}
	}
}
