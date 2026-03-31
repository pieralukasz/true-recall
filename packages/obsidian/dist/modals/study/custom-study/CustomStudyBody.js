import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useCustomStudyConfig } from "@true-recall/obsidian/modals/study/custom-study/hooks/useCustomStudyConfig";
import { NumberField } from "@true-recall/obsidian/modals/study/custom-study/NumberField";
import { Clickable, FormCard, FormField, SelectInput, } from "@true-recall/obsidian/components";
import { ModalFooter } from "@true-recall/obsidian/components/ModalFooter";
import { useRef } from "preact/hooks";
const REVIEW_ORDER_OPTIONS = [
    { value: "due-date", label: "Due date" },
    { value: "random", label: "Random" },
    { value: "due-date-random", label: "Due date (randomized)" },
    { value: "by-retrievability", label: "Retrievability" },
    { value: "most-lapses", label: "Most lapses" },
    { value: "relative-overdueness", label: "Relative overdueness" },
    { value: "lowest-stability", label: "Lowest stability" },
    { value: "order-added", label: "Order added" },
];
const STATE_FILTER_OPTIONS = [
    { value: "all", label: "All states" },
    { value: "new", label: "New only" },
    { value: "learning", label: "Learning only" },
    { value: "due", label: "Due only" },
];
const NUM_INPUT_CLS = "ep:w-16 ep:py-1.5 ep:px-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:text-right";
const PRESET_INPUT_CLS = "ep:w-full ep:py-1.5 ep:px-2.5 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted";
export function CustomStudyBody({ scopeLabel, onResolve, }) {
    const { config, updateConfig, buildResult } = useCustomStudyConfig();
    const presetInputRef = useRef(null);
    const handleStart = () => {
        var _a;
        const presetName = (_a = presetInputRef.current) === null || _a === void 0 ? void 0 : _a.value.trim();
        onResolve(buildResult(presetName));
    };
    return (_jsxs(_Fragment, { children: [scopeLabel && (_jsx("div", { class: "ep:mb-4 ep:flex ep:items-center ep:gap-2", children: _jsx("span", { class: "ep:text-ui-smaller ep:font-medium ep:px-2.5 ep:py-1 ep:rounded-full ep:bg-obs-accent/15 ep:text-obs-accent", children: scopeLabel }) })), _jsxs(FormCard, { title: "Filters", children: [_jsx(FormField, { name: "Card state", children: _jsx(SelectInput, { value: config.stateFilter, onChange: (v) => updateConfig("stateFilter", v), options: STATE_FILTER_OPTIONS }) }), _jsx(FormField, { name: "Difficulty range", description: "1-10", children: _jsxs("div", { class: "ep:flex ep:gap-2 ep:items-center", children: [_jsx("input", { type: "number", class: NUM_INPUT_CLS, min: "1", max: "10", step: "1", value: config.difficultyMin, onChange: (e) => updateConfig("difficultyMin", Math.max(1, Math.min(10, Number(e.target.value) || 1))) }), _jsx("span", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "to" }), _jsx("input", { type: "number", class: NUM_INPUT_CLS, min: "1", max: "10", step: "1", value: config.difficultyMax, onChange: (e) => updateConfig("difficultyMax", Math.max(1, Math.min(10, Number(e.target.value) || 10))) })] }) }), _jsx(NumberField, { id: "cs-lapses", label: "Minimum lapses", value: config.lapsesMin, onChange: (v) => updateConfig("lapsesMin", v), min: 0, step: 1 })] }), _jsxs(FormCard, { title: "Session", class: "ep:mt-4", children: [_jsx(FormField, { name: "Sort order", children: _jsx(SelectInput, { value: config.reviewOrder, onChange: (v) => updateConfig("reviewOrder", v), options: REVIEW_ORDER_OPTIONS }) }), _jsx(NumberField, { id: "cs-ahead", label: "Study ahead", description: "Days (0 = off)", value: config.studyAheadDays, onChange: (v) => updateConfig("studyAheadDays", v), min: 0, step: 1 }), _jsx(NumberField, { id: "cs-limit", label: "Card limit", description: "0 = no limit", value: config.cardLimit, onChange: (v) => updateConfig("cardLimit", v), min: 0, step: 10 }), _jsx(FormField, { name: "Cramming mode", description: "No scheduling changes", children: _jsx(Clickable, { class: "ep:flex ep:items-center ep:gap-2 ep:p-0", onClick: () => updateConfig("crammingMode", !config.crammingMode), children: _jsx("input", { type: "checkbox", class: "ep:w-4 ep:h-4", checked: config.crammingMode, onClick: (e) => e.stopPropagation(), onChange: (e) => updateConfig("crammingMode", e.target.checked) }) }) })] }), _jsx(FormField, { name: "Save as preset", description: "Optional", class: "ep:mt-4", children: _jsx("input", { id: "cs-preset", ref: presetInputRef, type: "text", class: PRESET_INPUT_CLS, placeholder: "Preset name..." }) }), _jsx(ModalFooter, { onCancel: () => onResolve({ cancelled: true }), onConfirm: handleStart, confirmLabel: "Start session" })] }));
}
