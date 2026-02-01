/**
 * ReactiveCache
 *
 * A cache that auto-invalidates based on EventBus events.
 * Solves the problem of manual cache invalidation by tying cache
 * validity to specific events in the system.
 *
 * Usage:
 *   const statsCache = new ReactiveCache({
 *     compute: async () => calculateStats(),
 *     invalidateOn: ['card:added', 'card:removed', 'card:reviewed'],
 *     ttlMs: 30000,
 *     eventBus,
 *   });
 *
 *   const stats = await statsCache.get(); // Computes on first call
 *   const stats2 = await statsCache.get(); // Returns cached
 *   // After 'card:added' event fires, next get() recomputes
 */
import type { EventBusService } from "../core/event-bus.service";
import type { FlashcardEventType } from "../../types/events.types";

export interface ReactiveCacheOptions<T> {
	/** Function to compute the cached value */
	compute: () => Promise<T>;
	/** Event types that trigger cache invalidation */
	invalidateOn: FlashcardEventType[];
	/** Optional TTL in milliseconds (cache expires after this time) */
	ttlMs?: number;
	/** EventBus instance for subscribing to events. If not provided, only TTL-based expiration is used. */
	eventBus?: EventBusService;
	/** Optional debug label for logging */
	label?: string;
}

export class ReactiveCache<T> {
	private cachedValue: T | null = null;
	private cacheTimestamp = 0;
	private computing = false;
	private pendingPromise: Promise<T> | null = null;
	private unsubscribers: (() => void)[] = [];
	private disposed = false;

	private readonly compute: () => Promise<T>;
	private readonly ttlMs: number;
	private readonly label: string;

	constructor(options: ReactiveCacheOptions<T>) {
		this.compute = options.compute;
		this.ttlMs = options.ttlMs ?? 0; // 0 = no TTL expiration
		this.label = options.label ?? "ReactiveCache";

		// Subscribe to invalidation events (only if eventBus provided)
		if (options.eventBus) {
			for (const eventType of options.invalidateOn) {
				const unsub = options.eventBus.on(eventType, () => {
					this.invalidate();
				});
				this.unsubscribers.push(unsub);
			}
		}
	}

	/**
	 * Get the cached value, computing if necessary
	 * @param forceRefresh - If true, ignores cache and recomputes
	 */
	async get(forceRefresh = false): Promise<T> {
		if (this.disposed) {
			throw new Error(`[${this.label}] Cache has been disposed`);
		}

		const now = Date.now();

		// Check if we have a valid cached value
		if (!forceRefresh && this.cachedValue !== null) {
			// Check TTL if set
			if (this.ttlMs === 0 || now - this.cacheTimestamp < this.ttlMs) {
				return this.cachedValue;
			}
		}

		// If already computing, return the pending promise (prevents parallel recomputes)
		if (this.computing && this.pendingPromise) {
			return this.pendingPromise;
		}

		// Compute new value
		this.computing = true;
		this.pendingPromise = this.compute()
			.then((value) => {
				this.cachedValue = value;
				this.cacheTimestamp = Date.now();
				return value;
			})
			.finally(() => {
				this.computing = false;
				this.pendingPromise = null;
			});

		return this.pendingPromise;
	}

	/**
	 * Invalidate the cache (next get() will recompute)
	 */
	invalidate(): void {
		if (this.disposed) return;
		this.cachedValue = null;
		this.cacheTimestamp = 0;
	}

	/**
	 * Check if the cache currently has a valid value
	 */
	hasValue(): boolean {
		if (this.cachedValue === null) return false;
		if (this.ttlMs === 0) return true;
		return Date.now() - this.cacheTimestamp < this.ttlMs;
	}

	/**
	 * Get cache metadata for debugging
	 */
	getStats(): { hasValue: boolean; ageMs: number; computing: boolean } {
		return {
			hasValue: this.cachedValue !== null,
			ageMs: this.cachedValue !== null ? Date.now() - this.cacheTimestamp : 0,
			computing: this.computing,
		};
	}

	/**
	 * Dispose the cache and unsubscribe from events
	 */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;

		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		this.cachedValue = null;
		this.pendingPromise = null;
	}
}
