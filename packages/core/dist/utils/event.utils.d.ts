/**
 * Event Listener Utilities
 * Provides safe event listener management to prevent memory leaks
 */
/**
 * Cleanup function type
 */
export type CleanupFn = () => void;
/**
 * Event listener registry for tracking and cleaning up event listeners
 */
export declare class EventRegistry {
    private cleanupFns;
    /**
     * Add an event listener with automatic tracking for cleanup
     */
    addEventListener<K extends keyof HTMLElementEventMap>(element: HTMLElement, type: K, listener: (ev: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
    /**
     * Add a generic event listener (for custom events)
     */
    addGenericListener(element: HTMLElement, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void;
    /**
     * Register a cleanup function
     */
    registerCleanup(cleanup: CleanupFn): void;
    /**
     * Clean up all registered event listeners
     */
    cleanup(): void;
    /**
     * Get number of registered cleanup functions
     */
    get size(): number;
}
/**
 * Create a new event registry
 */
export declare function createEventRegistry(): EventRegistry;
/**
 * Debounce function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 */
export declare function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Throttle function
 * @param fn Function to throttle
 * @param limit Time limit in milliseconds
 */
export declare function throttle<T extends (...args: unknown[]) => void>(fn: T, limit: number): (...args: Parameters<T>) => void;
