import { __awaiter } from "tslib";
import { Platform } from "obsidian";
/** Handles mobile vs desktop differences automatically */
export function activateView(app_1, viewType_1) {
    return __awaiter(this, arguments, void 0, function* (app, viewType, options = {}) {
        const { workspace } = app;
        const { useMainArea = false, state, skipReveal = false } = options;
        let leaf = workspace.getLeavesOfType(viewType)[0];
        if (!leaf) {
            if (Platform.isMobile || useMainArea) {
                leaf = workspace.getLeaf(true);
            }
            else {
                const rightLeaf = workspace.getRightLeaf(false);
                if (rightLeaf) {
                    leaf = rightLeaf;
                }
                else {
                    leaf = workspace.getLeaf(true);
                }
            }
            yield leaf.setViewState({
                type: viewType,
                active: true,
                state,
            });
        }
        if (leaf && !skipReveal) {
            void workspace.revealLeaf(leaf);
        }
        return leaf;
    });
}
export function activateMainAreaView(app, viewType, state) {
    return __awaiter(this, void 0, void 0, function* () {
        const { workspace } = app;
        const leaf = workspace.getLeaf(true);
        yield leaf.setViewState({
            type: viewType,
            active: true,
            state,
        });
        void workspace.revealLeaf(leaf);
        return leaf;
    });
}
export function activateReviewView(app, viewType, reviewMode, state) {
    return __awaiter(this, void 0, void 0, function* () {
        const { workspace } = app;
        const existingLeaf = workspace.getLeavesOfType(viewType)[0];
        if (existingLeaf) {
            yield existingLeaf.setViewState({
                type: viewType,
                active: true,
                state,
            });
            void workspace.revealLeaf(existingLeaf);
            return existingLeaf;
        }
        if (Platform.isMobile || reviewMode === "fullscreen") {
            return activateMainAreaView(app, viewType, state);
        }
        const rightLeaf = workspace.getRightLeaf(false);
        if (rightLeaf) {
            yield rightLeaf.setViewState({
                type: viewType,
                active: true,
                state,
            });
            void workspace.revealLeaf(rightLeaf);
            return rightLeaf;
        }
        return null;
    });
}
export function closeAllViews(app, viewType) {
    const leaves = app.workspace.getLeavesOfType(viewType);
    for (const leaf of leaves) {
        leaf.detach();
    }
}
export function viewExists(app, viewType) {
    return app.workspace.getLeavesOfType(viewType).length > 0;
}
export function getView(app, viewType) {
    var _a;
    return (_a = app.workspace.getLeavesOfType(viewType)[0]) !== null && _a !== void 0 ? _a : null;
}
