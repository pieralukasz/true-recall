import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useCallback, useRef } from "preact/hooks";
export function SimulatorControls({ simulator, onSequencesChange, onMetricChange, onOptionsChange, }) {
    const textareaRef = useRef(null);
    const handleReset = useCallback(() => {
        simulator.resetSequences();
        if (textareaRef.current) {
            textareaRef.current.value = simulator.getSequences().join("\n");
        }
        onSequencesChange();
    }, [simulator, onSequencesChange]);
    const handleTextareaInput = useCallback(() => {
        if (!textareaRef.current)
            return;
        const lines = textareaRef.current.value
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && /^[1-4]+$/.test(line));
        if (lines.length > 0) {
            simulator.setSequences(lines);
            onSequencesChange();
        }
    }, [simulator, onSequencesChange]);
    const currentMetric = simulator.getMetricType();
    const currentAnimation = simulator.getUseAnimation();
    const currentLogarithmic = simulator.getUseLogarithmic();
    const metrics = [
        { value: "interval", label: "Interval" },
        { value: "stability", label: "Stability" },
        { value: "difficulty", label: "Difficulty" },
        { value: "cumulative", label: "CumulativeInterval" },
    ];
    return (_jsxs("div", { class: "ep:bg-obs-secondary ep:rounded-lg ep:p-4", children: [_jsx(Clickable, { class: [
                    "ep:w-full ep:mb-3 ep:px-3 ep:py-2",
                    "ep:bg-obs-primary ep:text-obs-normal",
                    "ep:border ep:border-obs-border ep:rounded-lg",
                    "ep:text-ui-small",
                    "hover:ep:bg-obs-modifier-hover",
                ].join(" "), onClick: handleReset, children: "Reset reviews" }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-2", children: "1=Again, 2=Hard, 3=Good, 4=Easy" }), _jsx("textarea", { ref: textareaRef, class: [
                    "ep:w-full ep:h-37.5 ep:mb-4",
                    "ep:bg-obs-primary ep:text-obs-normal",
                    "ep:border ep:border-obs-border ep:rounded-lg",
                    "ep:p-2 ep:text-ui-small ep:font-mono",
                    "ep:resize-none",
                ].join(" "), value: simulator.getSequences().join("\n"), onInput: handleTextareaInput }), _jsx("div", { class: "ep:mb-4", children: metrics.map((metric) => (_jsxs("label", { class: "ep:flex ep:items-center ep:gap-2 ep:mb-1 ep:cursor-pointer ep:text-ui-small", children: [_jsx("input", { type: "radio", class: "ep:cursor-pointer", name: "metric-type", value: metric.value, checked: metric.value === currentMetric, onChange: () => {
                                simulator.setMetricType(metric.value);
                                onMetricChange();
                            } }), _jsx("span", { class: "ep:text-obs-normal", children: metric.label })] }, metric.value))) }), _jsxs("div", { children: [_jsxs("label", { class: "ep:flex ep:items-center ep:gap-2 ep:mb-1 ep:cursor-pointer ep:text-ui-small", children: [_jsx("input", { type: "checkbox", class: "ep:cursor-pointer", checked: currentAnimation, onChange: (e) => {
                                    simulator.setUseAnimation(e.target.checked);
                                    onOptionsChange();
                                } }), _jsx("span", { class: "ep:text-obs-normal", children: "Animation" })] }), _jsxs("label", { class: "ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-small", children: [_jsx("input", { type: "checkbox", class: "ep:cursor-pointer", checked: currentLogarithmic, onChange: (e) => {
                                    simulator.setUseLogarithmic(e.target.checked);
                                    onOptionsChange();
                                } }), _jsx("span", { class: "ep:text-obs-normal", children: "Logarithmic" })] })] })] }));
}
