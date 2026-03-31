import { __awaiter } from "tslib";
import { signal } from "@preact/signals";
import { VIEW_TYPE_CARD_BROWSER } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { ItemView } from "obsidian";
import { h } from "preact";
import { CardBrowserApp } from "./CardBrowserApp";
export class CardBrowserView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.filterSourceUid = signal(null);
        this.filterOrphaned = signal(false);
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_CARD_BROWSER;
    }
    getDisplayText() {
        return "Card browser";
    }
    getIcon() {
        return "table-2";
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            const container = this.containerEl.children[1];
            if (!(container instanceof HTMLElement))
                return;
            container.empty();
            container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
            this.unmountPreact = mountPreact(container, this.plugin, h(CardBrowserApp, {
                filterSourceUid: this.filterSourceUid,
                filterOrphaned: this.filterOrphaned,
            }));
        });
    }
    setState(state, result) {
        const _super = Object.create(null, {
            setState: { get: () => super.setState }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const s = state;
            if (s === null || s === void 0 ? void 0 : s.sourceUid) {
                this.filterSourceUid.value = s.sourceUid;
            }
            if (s === null || s === void 0 ? void 0 : s.orphaned) {
                this.filterOrphaned.value = true;
            }
            yield _super.setState.call(this, state, result);
        });
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        });
    }
}
