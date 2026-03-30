import { __awaiter } from "tslib";
import { DashboardApp } from "@true-recall/obsidian/views/dashboard/DashboardApp";
import { VIEW_TYPE_DASHBOARD } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { ItemView } from "obsidian";
import { h } from "preact";
export class DashboardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_DASHBOARD;
    }
    getDisplayText() {
        return "Dashboard";
    }
    getIcon() {
        return "layout-dashboard";
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            const container = this.containerEl.children[1];
            if (!(container instanceof HTMLElement))
                return;
            container.empty();
            container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
            this.unmountPreact = mountPreact(container, this.plugin, h(DashboardApp, null));
        });
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        });
    }
}
