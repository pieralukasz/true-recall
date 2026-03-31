import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
import { consumeDragState, createDropDeps, dragItemFromFlatItem, executeDrop, initDragTransfer, validateDrop, } from "./drag-drop";
export function useProjectDragDrop() {
    const plugin = usePlugin();
    const dragState = useSignal(null);
    const handleDragStart = useCallback((e, item) => {
        const dragItem = dragItemFromFlatItem(item);
        if (!dragItem) {
            e.preventDefault();
            return;
        }
        initDragTransfer(e, dragItem, dragState);
    }, [dragState]);
    const handleDragEnd = useCallback(() => {
        dragState.value = null;
    }, [dragState]);
    const handleDragOver = useCallback((e, targetItem) => {
        const ds = dragState.value;
        if (!ds)
            return;
        const targetPath = targetItem.type === "project-header"
            ? targetItem.project.path
            : targetItem.type === "note"
                ? targetItem.note.path
                : null;
        if (!targetPath || targetPath === ds.dropTargetPath) {
            if (ds.isValid)
                e.preventDefault();
            return;
        }
        const result = validateDrop(ds.item, targetItem, plugin.hierarchyService);
        dragState.value = Object.assign(Object.assign({}, ds), { dropTargetPath: targetPath, isValid: result !== null });
        if (result) {
            e.preventDefault();
            if (e.dataTransfer)
                e.dataTransfer.dropEffect = "move";
        }
    }, [dragState, plugin]);
    const handleDrop = useCallback((e, targetItem) => {
        const ds = consumeDragState(e, dragState);
        if (!ds)
            return;
        const result = validateDrop(ds.item, targetItem, plugin.hierarchyService);
        if (!result)
            return;
        void executeDrop(result, createDropDeps(plugin));
    }, [dragState, plugin]);
    const handleRootDrop = useCallback((e) => {
        var _a;
        const ds = consumeDragState(e, dragState);
        if (!ds || !ds.item.parentPath)
            return;
        const parentName = ((_a = ds.item.parentPath.split("/").pop()) !== null && _a !== void 0 ? _a : ds.item.parentPath).replace(/\.md$/, "");
        const result = {
            action: "unnest",
            dragPath: ds.item.path,
            dragName: ds.item.name,
            parentPath: ds.item.parentPath,
            parentName,
        };
        void executeDrop(result, createDropDeps(plugin));
    }, [dragState, plugin]);
    return {
        dragState,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDrop,
        handleRootDrop,
    };
}
