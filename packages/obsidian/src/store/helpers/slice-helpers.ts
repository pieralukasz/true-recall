import type { AppState } from "@shared/store/types";

type SetFn = (fn: (state: AppState) => Partial<AppState>) => void;
type GetFn = () => AppState;

/**
 * Toggle an item in a Set stored in a slice field.
 * Used for card selection, note selection, expanded sections, etc.
 */
export function toggleSetItem<K extends keyof AppState>(
	set: SetFn,
	get: GetFn,
	sliceKey: K,
	setField: keyof AppState[K],
): (item: string) => void {
	return (item: string) => {
		const slice = get()[sliceKey];
		const currentSet = slice[setField] as unknown as Set<string>;
		const newSet = new Set(currentSet);
		if (newSet.has(item)) {
			newSet.delete(item);
		} else {
			newSet.add(item);
		}
		set(
			(s) =>
				({
					[sliceKey]: { ...s[sliceKey], [setField]: newSet },
				}) as Partial<AppState>,
		);
	};
}

/**
 * Create standard enter/exit/toggle/isIn selection mode actions.
 * Works for slices that use the "normal" | "selecting" + Set<string> pattern.
 */
export function createSelectionActions<K extends keyof AppState>(
	set: SetFn,
	get: GetFn,
	sliceKey: K,
	modeField: keyof AppState[K],
	selectedField: keyof AppState[K],
): {
	enterSelectionMode: (initialId?: string) => void;
	exitSelectionMode: () => void;
	toggleSelection: (id: string) => void;
	isInSelectionMode: () => boolean;
	getSelectedIds: () => string[];
} {
	return {
		enterSelectionMode: (initialId?: string) => {
			const selected = new Set<string>();
			if (initialId) selected.add(initialId);
			set(
				(s) =>
					({
						[sliceKey]: {
							...s[sliceKey],
							[modeField]: "selecting",
							[selectedField]: selected,
						},
					}) as Partial<AppState>,
			);
		},

		exitSelectionMode: () => {
			set(
				(s) =>
					({
						[sliceKey]: {
							...s[sliceKey],
							[modeField]: "normal",
							[selectedField]: new Set<string>(),
						},
					}) as Partial<AppState>,
			);
		},

		toggleSelection: toggleSetItem(set, get, sliceKey, selectedField),

		isInSelectionMode: () => {
			const slice = get()[sliceKey];
			return (
				(slice as unknown as Record<string, unknown>)[modeField as string] ===
				"selecting"
			);
		},

		getSelectedIds: () => {
			const slice = get()[sliceKey];
			return Array.from(slice[selectedField] as unknown as Set<string>);
		},
	};
}
