import type { ReadonlySignal } from "@preact/signals";
import { effect } from "@preact/signals";
import {
	ReactiveCache as CoreReactiveCache,
	type ReactiveCacheOptions as CoreReactiveCacheOptions,
} from "@true-recall/core/utils/ReactiveCache";

// Re-export the core class for consumers that don't need signals
export { ReactiveCache } from "@true-recall/core/utils/ReactiveCache";

export interface ReactiveCacheOptions<T>
	extends Omit<CoreReactiveCacheOptions<T>, "subscribe"> {
	/** Signal(s) that trigger cache invalidation when their value changes */
	invalidateOn?: ReadonlySignal[];
}

/** Create a ReactiveCache that invalidates when Preact signals change */
export function createSignalCache<T>(
	options: ReactiveCacheOptions<T>,
): CoreReactiveCache<T> {
	const { invalidateOn, ...rest } = options;
	return new CoreReactiveCache({
		...rest,
		subscribe:
			invalidateOn && invalidateOn.length > 0
				? (onInvalidate) => {
						return effect(() => {
							for (const s of invalidateOn) void s.value;
							onInvalidate();
						});
					}
				: undefined,
	});
}
