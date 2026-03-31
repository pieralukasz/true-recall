import { __awaiter } from "tslib";
import { SimulatorApp } from "@true-recall/obsidian/views/simulator/SimulatorApp";
import { VIEW_TYPE_SIMULATOR } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { CategoryScale, Chart, Legend, LinearScale, LineController, LineElement, LogarithmicScale, PointElement, Title, Tooltip, } from "chart.js";
import { ItemView } from "obsidian";
import { h } from "preact";
// Register Chart.js components before any Preact rendering
Chart.register(CategoryScale, LinearScale, LogarithmicScale, LineElement, LineController, PointElement, Title, Tooltip, Legend);
export class SimulatorView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_SIMULATOR;
    }
    getDisplayText() {
        return "FSRS simulator";
    }
    getIcon() {
        return "activity";
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            const container = this.containerEl.children[1];
            if (!(container instanceof HTMLElement))
                return;
            container.empty();
            container.addClasses([
                "ep:overflow-y-auto",
                "ep:h-full",
                "ep:bg-obs-primary",
            ]);
            this.unmountPreact = mountPreact(container, this.plugin, h(SimulatorApp, null));
        });
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        });
    }
}
