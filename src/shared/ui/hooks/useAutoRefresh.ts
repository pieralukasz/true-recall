import type { ReadonlySignal } from "@preact/signals";
import { effect } from "@preact/signals";
import {
	dataVersion,
	settingsVersion,
	syncVersion,
	track,
} from "@shared/services/signals";
import { useEffect, useRef } from "preact/hooks";

/**
 * Auto-refresh hook that debounces a callback when reactive signals change.
 * Replaces the duplicated effect() → track(dataVersion) → debounced loadData pattern.
 *
 * By default tracks dataVersion. Pass additional signals to also trigger on
 * settings or sync changes.
 */
export function useAutoRefresh(
	loadData: () => void,
	options: {
		debounceMs?: number;
		signals?: ReadonlySignal[];
		skipFirst?: boolean;
	} = {},
): void {
	const { debounceMs = 500, signals = [], skipFirst = true } = options;
	const loadDataRef = useRef(loadData);
	loadDataRef.current = loadData;

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let isFirst = true;

		const allSignals = [dataVersion, ...signals];
		const dispose = effect(() => {
			track(...allSignals);

			if (skipFirst && isFirst) {
				isFirst = false;
				return;
			}

			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				loadDataRef.current();
				timer = null;
			}, debounceMs);
		});

		return () => {
			dispose();
			if (timer) clearTimeout(timer);
		};
	}, [debounceMs, skipFirst, ...signals]);
}

/** Convenience: tracks dataVersion + settingsVersion + syncVersion */
export function useAutoRefreshAll(
	loadData: () => void,
	debounceMs = 500,
): void {
	useAutoRefresh(loadData, {
		debounceMs,
		signals: [settingsVersion, syncVersion],
		skipFirst: true,
	});
}
