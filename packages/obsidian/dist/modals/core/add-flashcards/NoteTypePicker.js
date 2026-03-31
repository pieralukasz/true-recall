import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useMemo, useState } from "preact/hooks";
export function NoteTypePicker({ value, onChange, disabled, }) {
    const plugin = usePlugin();
    const [noteTypes, setNoteTypes] = useState([]);
    useEffect(() => {
        var _a;
        if (!((_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.noteTypes))
            return;
        const all = plugin.cardStore.noteTypes.getAll();
        setNoteTypes(all);
    }, [plugin.cardStore]);
    const sorted = useMemo(() => {
        // Hide Image Occlusion from the add-flashcard picker (not supported here)
        const filtered = noteTypes.filter((nt) => nt.id !== BUILTIN_IMAGE_OCCLUSION_ID);
        const builtins = filtered.filter((nt) => nt.isBuiltin);
        const custom = filtered
            .filter((nt) => !nt.isBuiltin)
            .sort((a, b) => a.name.localeCompare(b.name));
        return [...builtins, ...custom];
    }, [noteTypes]);
    return (_jsx("select", { class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:min-w-[160px] ep:disabled:opacity-60 ep:disabled:cursor-not-allowed", value: value, disabled: disabled, onChange: (e) => onChange(e.target.value), children: sorted.map((nt) => (_jsxs("option", { value: nt.id, children: [nt.name, nt.type === 1 ? " (cloze)" : "", !nt.isBuiltin ? " *" : ""] }, nt.id))) }));
}
