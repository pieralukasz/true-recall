import type { ReadonlySignal } from "@preact/signals";
import { effect, untracked } from "@preact/signals-core";
import { useEffect, useRef, useState } from "preact/hooks";

interface GatedComputedOptions {
	/** Visibility of the hosting view; observed without subscribing the component. */
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

export type GateAction =
	| { kind: "keep" }
	| { kind: "recompute" }
	| { kind: "trailing"; delayMs: number };

interface GateActionInput {
	/** True on the first reactive pass after the view became visible. */
	becameVisible: boolean;
	depsChanged: boolean;
	msSinceLastCompute: number;
	throttleMs: number;
}

/**
 * Decides what a visible gated computation should do with its cached state.
 * A reveal with stale deps bypasses the throttle so the next render receives
 * fresh data instead of first painting a stale frame.
 */
export function resolveGateAction({
	becameVisible,
	depsChanged,
	msSinceLastCompute,
	throttleMs,
}: GateActionInput): GateAction {
	if (!depsChanged) return { kind: "keep" };
	if (becameVisible || msSinceLastCompute >= throttleMs) {
		return { kind: "recompute" };
	}
	return { kind: "trailing", delayMs: throttleMs - msSinceLastCompute };
}

/**
 * useMemo variant for expensive derivations of hot signals (e.g. Q.ALL_META,
 * which changes on every review grade):
 *
 * - While the hosting view is hidden, `getDeps` is never called, so signals
 *   read inside it are not subscribed at all — the component neither
 *   re-renders nor recomputes on data changes. The visibility flip back to
 *   true refreshes the cached value before scheduling a single render.
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
	const wasVisibleRef = useRef(isVisible.peek());
	const computeRef = useRef(compute);
	const getDepsRef = useRef(getDeps);
	const throttleMsRef = useRef(throttleMs);
	computeRef.current = compute;
	getDepsRef.current = getDeps;
	throttleMsRef.current = throttleMs;

	const clearTrailingTimer = () => {
		if (trailingTimerRef.current !== null) {
			window.clearTimeout(trailingTimerRef.current);
			trailingTimerRef.current = null;
		}
	};

	const recompute = (deps: readonly unknown[]): GatedComputedState<T> => {
		clearTrailingTimer();
		const next: GatedComputedState<T> = {
			value: untracked(() => computeRef.current()),
			deps,
			computedAt: performance.now(),
		};
		stateRef.current = next;
		return next;
	};

	const refresh = () => {
		const state = stateRef.current;
		if (!state) return;
		const deps = untracked(() => getDepsRef.current());
		if (areDepsEqual(state.deps, deps)) return;
		recompute(deps);
		setTick((tick) => tick + 1);
	};

	const scheduleTrailingRefresh = (delayMs: number) => {
		if (trailingTimerRef.current !== null) return;
		trailingTimerRef.current = window.setTimeout(() => {
			trailingTimerRef.current = null;
			refresh();
		}, delayMs);
	};

	let state = stateRef.current;
	if (state === null) {
		state = recompute(untracked(() => getDepsRef.current()));
	}

	useEffect(() => {
		const dispose = effect(() => {
			const isViewVisible = isVisible.value;
			const becameVisible = isViewVisible && !wasVisibleRef.current;
			wasVisibleRef.current = isViewVisible;

			if (!isViewVisible) {
				clearTrailingTimer();
				return;
			}

			const current = stateRef.current;
			if (!current) return;
			const deps = getDepsRef.current();
			const action = resolveGateAction({
				becameVisible,
				depsChanged: !areDepsEqual(current.deps, deps),
				msSinceLastCompute: performance.now() - current.computedAt,
				throttleMs: throttleMsRef.current,
			});

			if (action.kind === "recompute") {
				recompute(deps);
				setTick((tick) => tick + 1);
			} else if (action.kind === "trailing") {
				scheduleTrailingRefresh(action.delayMs);
			}
		});

		return () => {
			dispose();
			clearTrailingTimer();
		};
	}, [isVisible]);

	return state.value;
}
