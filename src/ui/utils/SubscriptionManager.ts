/**
 * SubscriptionManager
 *
 * Consolidates cleanup of EventBus unsubscribers, timers, and other disposables.
 * Use in views/components to track all subscriptions and dispose them in one call.
 *
 * Usage:
 *   private subs = new SubscriptionManager();
 *
 *   // Track EventBus subscriptions
 *   this.subs.track(eventBus.on('card:removed', handler));
 *
 *   // Track timers (auto-cleared on dispose)
 *   this.subs.setTimeout(() => console.log('tick'), 1000);
 *   this.subs.setInterval(() => console.log('tick'), 1000);
 *
 *   // In onClose/cleanup:
 *   this.subs.dispose();
 */
export class SubscriptionManager {
	private unsubscribers: (() => void)[] = [];
	private timeouts: Set<ReturnType<typeof setTimeout>> = new Set();
	private intervals: Set<ReturnType<typeof setInterval>> = new Set();
	private disposed = false;

	/**
	 * Track a single unsubscribe function
	 * @returns this for chaining
	 */
	track(unsubscribe: () => void): this {
		if (this.disposed) {
			console.warn("[SubscriptionManager] Cannot track after dispose");
			return this;
		}
		this.unsubscribers.push(unsubscribe);
		return this;
	}

	/**
	 * Track multiple unsubscribe functions
	 * @returns this for chaining
	 */
	trackAll(...unsubscribes: (() => void)[]): this {
		if (this.disposed) {
			console.warn("[SubscriptionManager] Cannot track after dispose");
			return this;
		}
		this.unsubscribers.push(...unsubscribes);
		return this;
	}

	/**
	 * Create a tracked setTimeout that auto-clears on dispose
	 * @returns timer id for manual cancellation if needed
	 */
	setTimeout(callback: () => void, ms: number): ReturnType<typeof setTimeout> {
		if (this.disposed) {
			console.warn("[SubscriptionManager] Cannot create timer after dispose");
			return setTimeout(() => {}, 0);
		}
		const id = setTimeout(() => {
			this.timeouts.delete(id);
			callback();
		}, ms);
		this.timeouts.add(id);
		return id;
	}

	/**
	 * Create a tracked setInterval that auto-clears on dispose
	 * @returns interval id for manual cancellation if needed
	 */
	setInterval(callback: () => void, ms: number): ReturnType<typeof setInterval> {
		if (this.disposed) {
			console.warn("[SubscriptionManager] Cannot create interval after dispose");
			return setInterval(() => {}, 0);
		}
		const id = setInterval(callback, ms);
		this.intervals.add(id);
		return id;
	}

	/**
	 * Clear a specific timeout
	 */
	clearTimeout(id: ReturnType<typeof setTimeout>): void {
		if (this.timeouts.has(id)) {
			clearTimeout(id);
			this.timeouts.delete(id);
		}
	}

	/**
	 * Clear a specific interval
	 */
	clearInterval(id: ReturnType<typeof setInterval>): void {
		if (this.intervals.has(id)) {
			clearInterval(id);
			this.intervals.delete(id);
		}
	}

	/**
	 * Dispose all tracked subscriptions and timers
	 * Safe to call multiple times
	 */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;

		// Call all unsubscribers
		for (const unsub of this.unsubscribers) {
			try {
				unsub();
			} catch (error) {
				console.error("[SubscriptionManager] Error in unsubscriber:", error);
			}
		}
		this.unsubscribers = [];

		// Clear all timeouts
		for (const id of this.timeouts) {
			clearTimeout(id);
		}
		this.timeouts.clear();

		// Clear all intervals
		for (const id of this.intervals) {
			clearInterval(id);
		}
		this.intervals.clear();
	}

	/**
	 * Check if already disposed
	 */
	isDisposed(): boolean {
		return this.disposed;
	}

	/**
	 * Get count of tracked items (for debugging)
	 */
	getTrackedCount(): { unsubscribers: number; timeouts: number; intervals: number } {
		return {
			unsubscribers: this.unsubscribers.length,
			timeouts: this.timeouts.size,
			intervals: this.intervals.size,
		};
	}
}
