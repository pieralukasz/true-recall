import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { BUTTON_CLS } from "../utils/simulator-helpers";
import { Clickable } from "@true-recall/obsidian/components";
export function ParametersBar({ parametersString, canUndo, canRedo, onReset, onUndo, onRedo, }) {
    return (_jsxs("div", { class: "ep:mb-4", children: [_jsx("div", { class: [
                    "ep:text-ui-smaller ep:text-obs-muted",
                    "ep:bg-obs-secondary ep:p-2 ep:rounded-lg",
                    "ep:font-mono ep:mb-2",
                ].join(" "), children: parametersString }), _jsxs("div", { class: "ep:flex ep:gap-2 ep:items-center", children: [_jsx(Clickable, { class: BUTTON_CLS, onClick: onReset, children: "Reset parameters" }), _jsx(Clickable, { class: BUTTON_CLS, disabled: !canUndo, onClick: onUndo, children: "Undo" }), _jsx(Clickable, { class: BUTTON_CLS, disabled: !canRedo, onClick: onRedo, children: "Redo" }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2", children: "1 / 1" })] })] }));
}
