import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable, TextAreaInput } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { CHAT_PRESETS } from "../chat-config-presets";
const LENGTHS = [
    { value: "short", label: "Short" },
    { value: "medium", label: "Medium" },
    { value: "detailed", label: "Detailed" },
];
export function ChatConfigPanel({ config, onConfigChange }) {
    const plugin = usePlugin();
    const [local, setLocal] = useState(config);
    const saveTimer = useRef();
    const persist = useCallback((next) => {
        setLocal(next);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            Object.assign(plugin.settings, { ragChatConfig: next });
            void plugin.saveSettings();
            onConfigChange(next);
        }, 400);
    }, [plugin, onConfigChange]);
    const handlePreset = useCallback((presetId) => {
        const preset = CHAT_PRESETS.find((p) => p.id === presetId);
        if (!preset)
            return;
        persist({
            presetId: preset.id,
            customInstruction: preset.instruction,
            responseLength: preset.responseLength,
        });
    }, [persist]);
    const handleInstruction = useCallback((value) => {
        persist(Object.assign(Object.assign({}, local), { customInstruction: value, presetId: "custom" }));
    }, [local, persist]);
    const handleLength = useCallback((value) => {
        persist(Object.assign(Object.assign({}, local), { responseLength: value, presetId: "custom" }));
    }, [local, persist]);
    return (_jsxs("div", { class: "ep:border-b ep:border-obs-border ep:px-2 ep:py-3 ep:flex ep:flex-col ep:gap-3", children: [_jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-1.5", children: CHAT_PRESETS.map((preset) => (_jsx(Clickable, { class: `ep:text-xs ep:px-2.5 ep:py-1 ep:rounded-lg ep:border ep:transition-colors ${local.presetId === preset.id
                        ? "ep:border-obs-accent ep:text-obs-accent ep:bg-obs-accent/10"
                        : "ep:border-obs-border ep:text-obs-muted ep:hover:border-obs-interactive ep:hover:text-obs-normal"}`, onClick: () => handlePreset(preset.id), children: preset.label }, preset.id))) }), _jsx(TextAreaInput, { value: local.customInstruction, onChange: handleInstruction, placeholder: "Define your conversational goal, style, or role...", rows: 2, class: "!ep:text-xs" }), _jsxs("div", { children: [_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:mb-1.5", children: "Response length" }), _jsx("div", { class: "ep:flex ep:rounded-lg ep:border ep:border-obs-border ep:overflow-hidden", children: LENGTHS.map((opt) => (_jsx(Clickable, { class: `ep:flex-1 ep:text-center ep:text-xs ep:py-1.5 ep:transition-colors ${local.responseLength === opt.value
                                ? "ep:bg-obs-accent/15 ep:text-obs-accent ep:font-medium"
                                : "ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-secondary"}`, onClick: () => handleLength(opt.value), children: opt.label }, opt.value))) })] })] }));
}
