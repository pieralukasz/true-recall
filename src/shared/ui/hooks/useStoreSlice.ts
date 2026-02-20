import { useEffect, useState } from "preact/hooks";
import { usePlugin } from "../preact/ObsidianContext";
import type { AppState } from "../../store/types";

/**
 * Subscribe to a Zustand store slice and mirror it into Preact state.
 * Replaces the duplicated subscribe-and-setState pattern in panel/browser/noteHub/etc.
 *
 * The selector runs once for initial state, then on every store change.
 * Zustand's subscribeWithSelector ensures re-renders only when the selected
 * slice reference changes (shallow equality on the slice key).
 */
export function useStoreSlice<T>(
	sliceKey: keyof AppState,
	selector: (slice: AppState[typeof sliceKey]) => T,
): T {
	const plugin = usePlugin();
	const [state, setState] = useState<T>(() => {
		const slice = plugin.store?.getState()[sliceKey];
		if (!slice) return selector(undefined as unknown as AppState[typeof sliceKey]);
		return selector(slice);
	});

	useEffect(() => {
		if (!plugin.store) return;
		const unsub = plugin.store.subscribe(
			(s) => s[sliceKey],
			() => {
				const slice = plugin.store?.getState()[sliceKey];
				if (!slice) return;
				setState(selector(slice));
			},
		);
		return unsub;
	}, [plugin.store, sliceKey, selector]);

	return state;
}
