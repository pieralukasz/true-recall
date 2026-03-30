import { __awaiter } from "tslib";
import { NamePromptModal } from "@true-recall/obsidian/modals/study/NamePromptModal";
import { Notice, normalizePath, TFile } from "obsidian";
export const DRAG_MIME = "application/x-true-recall-dnd";
export function getDragClass(dragState, itemPath) {
    if (!dragState || !itemPath)
        return "";
    if (dragState.item.path === itemPath)
        return "ep-drag-source";
    if (dragState.dropTargetPath === itemPath && dragState.isValid)
        return "ep-drop-target";
    return "";
}
export function initDragTransfer(e, item, dragState) {
    var _a;
    (_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.setData(DRAG_MIME, JSON.stringify(item));
    if (e.dataTransfer)
        e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => {
        dragState.value = { item, dropTargetPath: null, isValid: false };
    });
}
export function consumeDragState(e, dragState) {
    e.preventDefault();
    const ds = dragState.value;
    dragState.value = null;
    return ds;
}
export function createDropDeps(plugin) {
    return {
        app: plugin.app,
        frontmatterService: plugin.flashcardManager.getFrontmatterService(),
        promptProjectName: (defaultName) => __awaiter(this, void 0, void 0, function* () {
            const modal = new NamePromptModal(plugin.app, defaultName);
            const res = yield modal.openAndWait();
            return res.cancelled ? null : res.name;
        }),
    };
}
export function dragItemFromFlatItem(item) {
    if (item.type === "project-header") {
        return {
            type: "project",
            path: item.project.path,
            name: item.project.name,
            parentPath: item.parentPath,
        };
    }
    if (item.type === "note" && item.note.path) {
        return {
            type: "note",
            path: item.note.path,
            name: item.note.name,
            parentPath: item.projectPath,
        };
    }
    return null;
}
function nameFromPath(path) {
    var _a;
    const last = (_a = path.split("/").pop()) !== null && _a !== void 0 ? _a : path;
    return last.replace(/\.md$/, "");
}
function isDescendant(ancestorPath, candidatePath, hierarchyService) {
    const visited = new Set();
    const queue = [ancestorPath];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current)
            break;
        if (visited.has(current))
            continue;
        visited.add(current);
        const children = hierarchyService.getChildPaths(current);
        for (const child of children) {
            if (child === candidatePath)
                return true;
            queue.push(child);
        }
    }
    return false;
}
export function validateDrop(drag, target, hierarchyService) {
    if (target.type === "empty-project")
        return null;
    const targetPath = target.type === "project-header" ? target.project.path : target.note.path;
    if (!targetPath)
        return null;
    if (drag.path === targetPath)
        return null;
    const targetName = nameFromPath(targetPath);
    if (target.type === "project-header") {
        if (drag.parentPath === targetPath)
            return null;
        if (drag.type === "project" &&
            isDescendant(drag.path, targetPath, hierarchyService)) {
            return null;
        }
        return {
            action: "reparent",
            dragPath: drag.path,
            dragName: drag.name,
            oldParentPath: drag.parentPath,
            newParentPath: targetPath,
            newParentName: targetName,
        };
    }
    if (target.type === "note" && drag.type === "note") {
        return {
            action: "create-project",
            dragPath: drag.path,
            dragName: drag.name,
            targetPath,
            targetName: target.note.name,
        };
    }
    return null;
}
export function executeDrop(result, deps) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { app, frontmatterService } = deps;
        switch (result.action) {
            case "reparent": {
                const file = app.vault.getAbstractFileByPath(result.dragPath);
                if (!(file instanceof TFile))
                    return;
                if (result.oldParentPath) {
                    const oldParentName = nameFromPath(result.oldParentPath);
                    yield frontmatterService.removeParent(file.path, oldParentName);
                }
                yield frontmatterService.addParent(file.path, result.newParentName);
                new Notice(`Moved "${result.dragName}" under "${result.newParentName}"`);
                break;
            }
            case "create-project": {
                const name = yield deps.promptProjectName("New Project");
                if (!name)
                    return;
                const targetFile = app.vault.getAbstractFileByPath(result.targetPath);
                if (!(targetFile instanceof TFile))
                    return;
                const folder = (_b = (_a = targetFile.parent) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "";
                const projectPath = normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
                if (app.vault.getAbstractFileByPath(projectPath)) {
                    new Notice(`A note already exists at "${projectPath}".`);
                    return;
                }
                yield app.vault.create(projectPath, "");
                const dragFile = app.vault.getAbstractFileByPath(result.dragPath);
                const targetFileForParent = app.vault.getAbstractFileByPath(result.targetPath);
                if (dragFile instanceof TFile) {
                    yield frontmatterService.addParent(dragFile.path, name);
                }
                if (targetFileForParent instanceof TFile) {
                    yield frontmatterService.addParent(targetFileForParent.path, name);
                }
                new Notice(`Created project "${name}" with 2 notes`);
                break;
            }
            case "unnest": {
                const file = app.vault.getAbstractFileByPath(result.dragPath);
                if (!(file instanceof TFile))
                    return;
                yield frontmatterService.removeParent(file.path, result.parentName);
                new Notice(`Moved "${result.dragName}" to root`);
                break;
            }
        }
    });
}
