export interface ReactiveCacheOptions<T> {
    compute: () => Promise<T>;
    /** Subscribe to invalidation signals. Return a disposer function. */
    subscribe?: (onInvalidate: () => void) => () => void;
    ttlMs?: number;
    label?: string;
}
export declare class ReactiveCache<T> {
    private cachedValue;
    private cacheTimestamp;
    private computing;
    private pendingPromise;
    private disposer;
    private disposed;
    private readonly compute;
    private readonly ttlMs;
    private readonly label;
    constructor(options: ReactiveCacheOptions<T>);
    get(forceRefresh?: boolean): Promise<T>;
    invalidate(): void;
    hasValue(): boolean;
    getStats(): {
        hasValue: boolean;
        ageMs: number;
        computing: boolean;
    };
    dispose(): void;
}
