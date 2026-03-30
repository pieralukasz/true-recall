/**
 * Event Listener Utilities
 * Provides safe event listener management to prevent memory leaks
 */
/**
 * Event listener registry for tracking and cleaning up event listeners
 */
export class EventRegistry {
    constructor() {
        this.cleanupFns = [];
    }
    /**
     * Add an event listener with automatic tracking for cleanup
     */
    addEventListener(element, type, listener, options) {
        element.addEventListener(type, listener, options);
        this.cleanupFns.push(() => element.removeEventListener(type, listener, options));
    }
    /**
     * Add a generic event listener (for custom events)
     */
    addGenericListener(element, type, listener, options) {
        element.addEventListener(type, listener, options);
        this.cleanupFns.push(() => element.removeEventListener(type, listener, options));
    }
    /**
     * Register a cleanup function
     */
    registerCleanup(cleanup) {
        this.cleanupFns.push(cleanup);
    }
    /**
     * Clean up all registered event listeners
     */
    cleanup() {
        this.cleanupFns.forEach((fn) => {
            try {
                fn();
            }
            catch (error) {
                console.error("Error during event cleanup:", error);
            }
        });
        this.cleanupFns = [];
    }
    /**
     * Get number of registered cleanup functions
     */
    get size() {
        return this.cleanupFns.length;
    }
}
/**
 * Create a new event registry
 */
export function createEventRegistry() {
    return new EventRegistry();
}
/**
 * Debounce function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 */
export function debounce(fn, delay) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delay);
    };
}
/**
 * Throttle function
 * @param fn Function to throttle
 * @param limit Time limit in milliseconds
 */
export function throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}
