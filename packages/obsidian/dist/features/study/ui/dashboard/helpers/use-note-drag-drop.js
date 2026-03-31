import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
import { consumeDragState, createDropDeps, executeDrop, initDragTransfer, } from "./drag-drop";
export function useNoteDragDrop() {
    const plugin = usePlugin();
    const dragState = useSignal(null);
    const handleDragStart = useCallback((e, note) => {
        if (!note.path) {
            e.preventDefault();
            return;
        }
        initDragTransfer(e, { type: "note", path: note.path, name: note.name, parentPath: null }, dragState);
    }, [dragState]);
    const handleDragEnd = useCallback(() => {
        dragState.value = null;
    }, [dragState]);
    const handleDragOver = useCallback((e, targetNote) => {
        const ds = dragState.value;
        if (!ds || !targetNote.path || targetNote.path === ds.item.path)
            return;
        if (targetNote.path !== ds.dropTargetPath) {
            dragState.value = Object.assign(Object.assign({}, ds), { dropTargetPath: targetNote.path, isValid: true });
        }
        e.preventDefault();
        if (e.dataTransfer)
            e.dataTransfer.dropEffect = "move";
    }, [dragState]);
    const handleDrop = useCallback((e, targetNote) => {
        const ds = consumeDragState(e, dragState);
        if (!ds || !targetNote.path || targetNote.path === ds.item.path)
            return;
        const result = {
            action: "create-project",
            dragPath: ds.item.path,
            dragName: ds.item.name,
            targetPath: targetNote.path,
            targetName: targetNote.name,
        };
        void executeDrop(result, createDropDeps(plugin));
    }, [dragState, plugin]);
    return {
        dragState,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDrop,
    };
}
