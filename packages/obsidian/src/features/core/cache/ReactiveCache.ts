import type { ReadonlySignal } from "@preact/signals";
import { effect } from "@preact/signals";

export interface ReactiveCacheOptions<T> {
	compute: () => Promise<T>;
	/** Signal(s) that trigger cache invalidation when their value changes */
	invalidateOn?: ReadonlySignal[];
	ttlMs?: number;
	label?: string;
}

export class ReactiveCache<T> {
	private cachedValue: T | null = null;
	private cacheTimestamp = 0;
	private computing = false;
	private pendingPromise: Promise<T> | null = null;
	private disposer: (() => void) | null = null;
	private disposed = false;

	private readonly compute: () => Promise<T>;
	private readonly ttlMs: number;
	private readonly label: string;

	constructor(options: ReactiveCacheOptions<T>) {
		this.compute = options.compute;
		this.ttlMs = options.ttlMs ?? 0;
		this.label = options.label ?? "ReactiveCache";

		if (options.invalidateOn && options.invalidateOn.length > 0) {
			const signals = options.invalidateOn;
			this.disposer = effect(() => {
				for (const s of signals) void s.value;
				this.invalidate();
			});
		}
	}

	async get(forceRefresh = false): Promise<T> {
		if (this.disposed) {
			throw new Error(`[${this.label}] Cache has been disposed`);
		}

		const now = Date.now();

		if (!forceRefresh && this.cachedValue !== null) {
			if (this.ttlMs === 0 || now - this.cacheTimestamp < this.ttlMs) {
				return this.cachedValue;
			}
		}

		if (this.computing && this.pendingPromise) {
			return this.pendingPromise;
		}

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

	invalidate(): void {
		if (this.disposed) return;
		this.cachedValue = null;
		this.cacheTimestamp = 0;
	}

	hasValue(): boolean {
		if (this.cachedValue === null) return false;
		if (this.ttlMs === 0) return true;
		return Date.now() - this.cacheTimestamp < this.ttlMs;
	}

	getStats(): { hasValue: boolean; ageMs: number; computing: boolean } {
		return {
			hasValue: this.cachedValue !== null,
			ageMs: this.cachedValue !== null ? Date.now() - this.cacheTimestamp : 0,
			computing: this.computing,
		};
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;

		this.disposer?.();
		this.disposer = null;
		this.cachedValue = null;
		this.pendingPromise = null;
	}
}
