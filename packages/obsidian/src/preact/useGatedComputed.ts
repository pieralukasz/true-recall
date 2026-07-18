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

export type GateAction =
	| { kind: "keep" }
	| { kind: "recompute" }
	| { kind: "trailing"; delayMs: number };

interface GateActionInput {
	/** True on the first render after the view flipped from hidden to visible. */
	becameVisible: boolean;
	depsChanged: boolean;
	msSinceLastCompute: number;
	throttleMs: number;
}

/**
 * Decides what a visible gated computation should do with its cached state.
 * A reveal recomputes immediately — the cached value may be arbitrarily old
 * (the view was unsubscribed while hidden), so throttling it would show
 * stale data for up to `throttleMs` right when the user looks at it.
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
 *   true re-renders and recomputes with fresh deps immediately, bypassing
 *   the throttle.
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
	const wasVisibleRef = useRef(false);

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
	const becameVisible = isViewVisible && !wasVisibleRef.current;
	wasVisibleRef.current = isViewVisible;

	let state = stateRef.current;
	if (state === null) {
		state = recompute(getDeps());
	} else if (isViewVisible) {
		const deps = getDeps();
		const action = resolveGateAction({
			becameVisible,
			depsChanged: !areDepsEqual(state.deps, deps),
			msSinceLastCompute: performance.now() - state.computedAt,
			throttleMs,
		});
		if (action.kind === "recompute") {
			state = recompute(deps);
		} else if (action.kind === "trailing") {
			scheduleTrailingRefresh(action.delayMs);
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
