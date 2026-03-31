/**
 * Toggle an item in a Set stored in a slice field.
 * Used for card selection, note selection, expanded sections, etc.
 */
export function toggleSetItem(set, get, sliceKey, setField) {
    return (item) => {
        const slice = get()[sliceKey];
        const currentSet = slice[setField];
        const newSet = new Set(currentSet);
        if (newSet.has(item)) {
            newSet.delete(item);
        }
        else {
            newSet.add(item);
        }
        set((s) => ({
            [sliceKey]: Object.assign(Object.assign({}, s[sliceKey]), { [setField]: newSet }),
        }));
    };
}
/**
 * Create standard enter/exit/toggle/isIn selection mode actions.
 * Works for slices that use the "normal" | "selecting" + Set<string> pattern.
 */
export function createSelectionActions(set, get, sliceKey, modeField, selectedField) {
    return {
        enterSelectionMode: (initialId) => {
            const selected = new Set();
            if (initialId)
                selected.add(initialId);
            set((s) => ({
                [sliceKey]: Object.assign(Object.assign({}, s[sliceKey]), { [modeField]: "selecting", [selectedField]: selected }),
            }));
        },
        exitSelectionMode: () => {
            set((s) => ({
                [sliceKey]: Object.assign(Object.assign({}, s[sliceKey]), { [modeField]: "normal", [selectedField]: new Set() }),
            }));
        },
        toggleSelection: toggleSetItem(set, get, sliceKey, selectedField),
        isInSelectionMode: () => {
            const slice = get()[sliceKey];
            return (slice[modeField] ===
                "selecting");
        },
        getSelectedIds: () => {
            const slice = get()[sliceKey];
            return Array.from(slice[selectedField]);
        },
    };
}
