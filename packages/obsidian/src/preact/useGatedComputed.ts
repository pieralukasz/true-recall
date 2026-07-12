import type { ReadonlySignal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";

interface GatedComputedOptions {
	/** Visibility of the hosting view; read during render so reveals re-render. */
	isVisible: ReadonlySignal<boolean>;
	/** Minimum interval between recomputes while visible. 0 = every deps change. */
	throttleMs?: number;
}

interface GatedComputedState<T> {
	value: T;
	deps: readonly unknown[];
	computedAt: number;
}

function areDepsEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
	return a.length === b.length && a.every((dep, i) => Object.is(dep, b[i]));
}

/**
 * useMemo variant for expensive derivations of hot signals (e.g. Q.ALL_META,
 * which changes on every review grade):
 *
 * - While the hosting view is hidden, `getDeps` is never called, so signals
 *   read inside it are not subscribed at all — the component neither
 *   re-renders nor recomputes on data changes. The visibility flip back to
 *   true re-renders and recomputes with fresh deps.
 * - While visible, recomputes at most once per `throttleMs`; a throttled
 *   change schedules a trailing refresh so the final state is never dropped.
 *
 * `getDeps` must read every signal the computation depends on (deps identity
 * is compared with Object.is, like useMemo).
 */
export function useGatedComputed<T>(
	compute: () => T,
	getDeps: () => readonly unknown[],
	{ isVisible, throttleMs = 0 }: GatedComputedOptions,
): T {
	const [, setTick] = useState(0);
	const stateRef = useRef<GatedComputedState<T> | null>(null);
	const trailingTimerRef = useRef<number | null>(null);

	const scheduleTrailingRefresh = (delayMs: number) => {
		if (trailingTimerRef.current !== null) return;
		trailingTimerRef.current = window.setTimeout(() => {
			trailingTimerRef.current = null;
			setTick((tick) => tick + 1);
		}, delayMs);
	};

	const recompute = (deps: readonly unknown[]): GatedComputedState<T> => {
		if (trailingTimerRef.current !== null) {
			window.clearTimeout(trailingTimerRef.current);
			trailingTimerRef.current = null;
		}
		const next: GatedComputedState<T> = {
			value: compute(),
			deps,
			computedAt: performance.now(),
		};
		stateRef.current = next;
		return next;
	};

	const isViewVisible = isVisible.value;

	let state = stateRef.current;
	if (state === null) {
		state = recompute(getDeps());
	} else if (isViewVisible) {
		const deps = getDeps();
		if (!areDepsEqual(state.deps, deps)) {
			const sinceLastCompute = performance.now() - state.computedAt;
			if (sinceLastCompute >= throttleMs) {
				state = recompute(deps);
			} else {
				scheduleTrailingRefresh(throttleMs - sinceLastCompute);
			}
		}
	}

	useEffect(
		() => () => {
			if (trailingTimerRef.current !== null) {
				window.clearTimeout(trailingTimerRef.current);
			}
		},
		[],
	);

	return state.value;
}
