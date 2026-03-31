import { effect } from "@preact/signals";
import { noteStatusMap, } from "@true-recall/obsidian/services/reactive-card-store";
import { lastMutation } from "@true-recall/obsidian/services/signals";
export function createNoteStatusCache() {
    let version = 1;
    const dispose = effect(() => {
        if (!lastMutation.value)
            return;
        version++;
    });
    return {
        get: (uid) => { var _a; return (_a = noteStatusMap.value.get(uid)) !== null && _a !== void 0 ? _a : null; },
        hasData: () => noteStatusMap.value.size > 0,
        getVersion: () => version,
        bumpVersion: () => {
            version++;
        },
        dispose,
    };
}
