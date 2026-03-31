import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { render } from "preact";
import { useCallback, useRef } from "preact/hooks";
import { BasePromiseModal } from "./BasePromiseModal";
export class TextInputModal extends BasePromiseModal {
    constructor(app, options) {
        var _a;
        super(app, {
            title: (_a = options.title) !== null && _a !== void 0 ? _a : "Input",
            width: "400px",
        });
        this.options = options;
    }
    getDefaultResult() {
        return { value: null };
    }
    renderBody(container) {
        const handleConfirm = (value) => this.resolve({ value: value || null });
        const handleCancel = () => this.resolve({ value: null });
        render(_jsx(TextInputBody, { label: this.options.label, placeholder: this.options.placeholder, defaultValue: this.options.defaultValue, confirmLabel: this.options.confirmLabel, cancelLabel: this.options.cancelLabel, onConfirm: handleConfirm, onCancel: handleCancel }), container);
    }
}
function TextInputBody({ label, placeholder, defaultValue, confirmLabel, cancelLabel, onConfirm, onCancel, }) {
    const inputRef = useRef(null);
    const handleSubmit = useCallback(() => {
        var _a, _b;
        onConfirm((_b = (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : "");
    }, [onConfirm]);
    return (_jsxs("div", { children: [_jsxs("label", { class: "ep:block ep:text-obs-normal ep:text-sm ep:mb-2", children: [label, _jsx("input", { ref: inputRef, type: "text", class: "ep:w-full ep:p-2 ep:rounded ep:border ep:border-obs-border ep:bg-obs-background-modifier-form ep:text-obs-normal ep:mt-1 ep:mb-4", placeholder: placeholder, value: defaultValue, onKeyDown: (e) => {
                            if (e.key === "Enter")
                                handleSubmit();
                        } })] }), _jsxs("div", { class: "ep:flex ep:justify-end ep:gap-2", children: [_jsx(Clickable, { class: "ep-btn ep-btn-outline", onClick: onCancel, stopPropagation: false, children: cancelLabel !== null && cancelLabel !== void 0 ? cancelLabel : "Cancel" }), _jsx(Clickable, { class: "mod-cta ep-btn", onClick: handleSubmit, stopPropagation: false, children: confirmLabel !== null && confirmLabel !== void 0 ? confirmLabel : "OK" })] })] }));
}
export function promptText(app, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const modal = new TextInputModal(app, options);
        const result = yield modal.openAndWait();
        return result.value;
    });
}
