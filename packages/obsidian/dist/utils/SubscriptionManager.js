/**
 * SubscriptionManager
 *
 * Consolidates cleanup of disposers, timers, and other disposables.
 * Use in views/components to track all subscriptions and dispose them in one call.
 *
 * Usage:
 *   private subs = new SubscriptionManager();
 *
 *   // Track signal effect disposers
 *   this.subs.track(effect(() => { cards.value; reload(); }));
 *
 *   // Track timers (auto-cleared on dispose)
 *   this.subs.setTimeout(() => console.log('tick'), 1000);
 *   this.subs.setInterval(() => console.log('tick'), 1000);
 *
 *   // In onClose/cleanup:
 *   this.subs.dispose();
 */
export class SubscriptionManager {
    constructor() {
        this.unsubscribers = [];
        this.timeouts = new Set();
        this.intervals = new Set();
        this.disposed = false;
    }
    /**
     * Track a single unsubscribe function
     * @returns this for chaining
     */
    track(unsubscribe) {
        if (this.disposed) {
            console.error("[SubscriptionManager] Cannot track after dispose");
            return this;
        }
        this.unsubscribers.push(unsubscribe);
        return this;
    }
    /**
     * Track multiple unsubscribe functions
     * @returns this for chaining
     */
    trackAll(...unsubscribes) {
        if (this.disposed) {
            console.error("[SubscriptionManager] Cannot track after dispose");
            return this;
        }
        this.unsubscribers.push(...unsubscribes);
        return this;
    }
    /**
     * Create a tracked setTimeout that auto-clears on dispose
     * @returns timer id for manual cancellation if needed
     */
    setTimeout(callback, ms) {
        if (this.disposed) {
            console.error("[SubscriptionManager] Cannot create timer after dispose");
            return setTimeout(() => { }, 0);
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
    setInterval(callback, ms) {
        if (this.disposed) {
            console.error("[SubscriptionManager] Cannot create interval after dispose");
            return setInterval(() => { }, 0);
        }
        const id = setInterval(callback, ms);
        this.intervals.add(id);
        return id;
    }
    /**
     * Clear a specific timeout
     */
    clearTimeout(id) {
        if (this.timeouts.has(id)) {
            clearTimeout(id);
            this.timeouts.delete(id);
        }
    }
    /**
     * Clear a specific interval
     */
    clearInterval(id) {
        if (this.intervals.has(id)) {
            clearInterval(id);
            this.intervals.delete(id);
        }
    }
    /**
     * Dispose all tracked subscriptions and timers
     * Safe to call multiple times
     */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const unsub of this.unsubscribers) {
            try {
                unsub();
            }
            catch (error) {
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
    isDisposed() {
        return this.disposed;
    }
    /**
     * Get count of tracked items (for debugging)
     */
    getTrackedCount() {
        return {
            unsubscribers: this.unsubscribers.length,
            timeouts: this.timeouts.size,
            intervals: this.intervals.size,
        };
    }
}
