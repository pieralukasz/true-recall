import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { TrueRecallSettings } from "@true-recall/core";

type SaveSettings = (patch: Partial<TrueRecallSettings>) => Promise<void>;

type SliceUpdater<T> = T | ((current: T) => T);

interface PersistentSettingsSliceOptions<T> {
	debounceMs?: number;
	normalize?: (value: T) => T;
	buildPatch: (value: T) => Partial<TrueRecallSettings>;
	/**
	 * When it returns false the value stays a local draft: nothing is saved
	 * and settings changes do not overwrite it, until the value is valid.
	 */
	canPersist?: (value: T) => boolean;
}

interface PersistOptions {
	flush?: boolean;
}

const DEFAULT_DEBOUNCE_MS = 400;

export function usePersistentSettingsSlice<T>(
	initialValue: T,
	save: SaveSettings,
	options: PersistentSettingsSliceOptions<T>,
) {
	const normalizeRef = useRef(options.normalize);
	const buildPatchRef = useRef(options.buildPatch);
	const canPersistRef = useRef(options.canPersist);
	const saveRef = useRef(save);
	const timerRef = useRef<number | null>(null);
	const dirtyRef = useRef(false);

	const [value, setValue] = useState<T>(() =>
		options.normalize ? options.normalize(initialValue) : initialValue,
	);
	const valueRef = useRef(value);

	useEffect(() => {
		saveRef.current = save;
	}, [save]);

	useEffect(() => {
		normalizeRef.current = options.normalize;
		buildPatchRef.current = options.buildPatch;
		canPersistRef.current = options.canPersist;
	}, [options.normalize, options.buildPatch, options.canPersist]);

	useEffect(() => {
		if (dirtyRef.current) return;
		const normalized = normalizeRef.current
			? normalizeRef.current(initialValue)
			: initialValue;
		valueRef.current = normalized;
		setValue(normalized);
	}, [initialValue]);

	const flush = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (!dirtyRef.current) return;
		if (canPersistRef.current && !canPersistRef.current(valueRef.current)) {
			return;
		}
		dirtyRef.current = false;
		void saveRef.current(buildPatchRef.current(valueRef.current));
	}, []);

	const persist = useCallback(
		(updater: SliceUpdater<T>, persistOptions?: PersistOptions) => {
			const rawNext =
				typeof updater === "function"
					? (updater as (current: T) => T)(valueRef.current)
					: updater;
			const next = normalizeRef.current
				? normalizeRef.current(rawNext)
				: rawNext;

			valueRef.current = next;
			dirtyRef.current = true;
			setValue(next);

			if (timerRef.current !== null) {
				window.clearTimeout(timerRef.current);
				timerRef.current = null;
			}

			if (persistOptions?.flush) {
				flush();
				return;
			}

			timerRef.current = window.setTimeout(
				flush,
				options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
			);
		},
		[flush, options.debounceMs],
	);

	useEffect(() => () => flush(), [flush]);

	return [value, persist, flush] as const;
}
