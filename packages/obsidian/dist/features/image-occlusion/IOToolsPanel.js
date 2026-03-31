import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { IconToolButton } from "./IOIconToolButton";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
export function IOToolsPanel({ tool, hasRegions, selectedRegionId, aiPromptVisible, aiLoading, aiCustomHint, hasAIKey, hasImage, onToolChange, onSetLastNonSelectTool, onDeleteSelected, onToggleAiPrompt, onAiCustomHintChange, onAiDetect, }) {
    return (_jsxs("div", { class: "true-recall-io-side-section", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-1", children: "Tools" }), _jsxs("div", { class: "true-recall-io-tool-row", children: [hasRegions && (_jsx(IconToolButton, { icon: "mouse-pointer-2", label: "Select", shortcut: "V", active: tool === "select", onClick: () => onToolChange("select") })), _jsx(IconToolButton, { icon: "square", label: "Rectangle", shortcut: "R", active: tool === "rect", onClick: () => {
                            onSetLastNonSelectTool("rect");
                            onToolChange("rect");
                        } }), _jsx(IconToolButton, { icon: "circle", label: "Ellipse", shortcut: "E", active: tool === "ellipse", onClick: () => {
                            onSetLastNonSelectTool("ellipse");
                            onToolChange("ellipse");
                        } }), _jsx(IconToolButton, { icon: "sparkles", label: "AI detect regions", active: aiPromptVisible, disabled: !hasImage || aiLoading || !hasAIKey, onClick: onToggleAiPrompt }), selectedRegionId && (_jsx(IconToolButton, { icon: "trash-2", label: "Delete selected region", shortcut: "Delete", danger: true, onClick: onDeleteSelected }))] }), _jsx("div", { class: "true-recall-io-hint-text", children: "Shortcuts: Delete to remove, Space + drag to pan, Ctrl/Cmd+V to paste. Click a region to switch to Select." }), aiPromptVisible && !aiLoading && (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-1.5 ep:mt-1", children: [_jsx("input", { type: "text", class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", placeholder: "Optional hint, e.g. 'label the bones'", maxLength: 50, value: aiCustomHint, onInput: (e) => onAiCustomHintChange(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter") {
                                onAiDetect(aiCustomHint);
                            }
                            else if (e.key === "Escape") {
                                onToggleAiPrompt();
                            }
                        } }), _jsxs("div", { class: "ep:flex ep:gap-2", children: [_jsx(Clickable, { class: "ep:px-3 ep:py-1 ep:text-ui-smaller ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:border ep:border-obs-accent ep:transition-colors", onClick: () => onAiDetect(aiCustomHint), children: "Detect" }), _jsx(Clickable, { class: "ep:px-3 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors", onClick: onToggleAiPrompt, children: "Cancel" })] })] })), aiLoading && (_jsxs("div", { class: "true-recall-io-hint-text ep:flex ep:items-center ep:gap-2", children: [_jsx("svg", { viewBox: "0 0 24 24", width: "14", height: "14", class: "ep:text-obs-muted", "aria-hidden": "true", children: _jsx("circle", { cx: "12", cy: "12", r: "10", stroke: "currentColor", "stroke-width": "3", fill: "none", "stroke-dasharray": "31.4 31.4", "stroke-linecap": "round", children: _jsx("animateTransform", { attributeName: "transform", type: "rotate", dur: "1s", from: "0 12 12", to: "360 12 12", repeatCount: "indefinite" }) }) }), "Detecting regions\u2026"] }))] }));
}
