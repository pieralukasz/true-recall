import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { render } from "preact";
import { BasePromiseModal } from "./BasePromiseModal";
export class ConfirmModal extends BasePromiseModal {
    constructor(app, options) {
        var _a;
        super(app, {
            title: (_a = options.title) !== null && _a !== void 0 ? _a : "Confirm",
            width: "400px",
        });
        this.options = options;
    }
    getDefaultResult() {
        return { confirmed: false };
    }
    renderBody(container) {
        var _a, _b;
        const handleConfirm = () => this.resolve({ confirmed: true });
        const handleCancel = () => this.resolve({ confirmed: false });
        render(_jsxs("div", { children: [_jsx("p", { class: "ep:text-obs-normal ep:leading-relaxed ep:mb-4", children: this.options.message }), _jsxs("div", { class: "ep:flex ep:justify-end ep:gap-2", children: [_jsx(Clickable, { class: "ep-btn ep-btn-outline", onClick: handleCancel, stopPropagation: false, children: (_a = this.options.cancelLabel) !== null && _a !== void 0 ? _a : "Cancel" }), _jsx(Clickable, { class: "mod-cta ep-btn", onClick: handleConfirm, stopPropagation: false, children: (_b = this.options.confirmLabel) !== null && _b !== void 0 ? _b : "Confirm" })] })] }), container);
    }
}
export function confirm(app, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const modal = new ConfirmModal(app, options);
        const result = yield modal.openAndWait();
        return result.confirmed;
    });
}
