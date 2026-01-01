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
export class EventRegistry {
    private cleanupFns: CleanupFn[] = [];

    /**
     * Add an event listener with automatic tracking for cleanup
     */
    addEventListener<K extends keyof HTMLElementEventMap>(
        element: HTMLElement,
        type: K,
        listener: (ev: HTMLElementEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ): void {
        element.addEventListener(type, listener, options);
        this.cleanupFns.push(() => element.removeEventListener(type, listener, options));
    }

    /**
     * Add a generic event listener (for custom events)
     */
    addGenericListener(
        element: HTMLElement,
        type: string,
        listener: EventListener,
        options?: boolean | AddEventListenerOptions
    ): void {
        element.addEventListener(type, listener, options);
        this.cleanupFns.push(() => element.removeEventListener(type, listener, options));
    }

    /**
     * Register a cleanup function
     */
    registerCleanup(cleanup: CleanupFn): void {
        this.cleanupFns.push(cleanup);
    }

    /**
     * Clean up all registered event listeners
     */
    cleanup(): void {
        this.cleanupFns.forEach((fn) => {
            try {
                fn();
            } catch (error) {
                console.error("Error during event cleanup:", error);
            }
        });
        this.cleanupFns = [];
    }

    /**
     * Get number of registered cleanup functions
     */
    get size(): number {
        return this.cleanupFns.length;
    }
}

/**
 * Create a new event registry
 */
export function createEventRegistry(): EventRegistry {
    return new EventRegistry();
}

/**
 * Debounce function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
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
export function throttle<T extends (...args: unknown[]) => void>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}
