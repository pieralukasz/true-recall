import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { GENERATION_LANGUAGES } from "@true-recall/core/ai/prompts/default-prompts";
import { useSettings } from "../hooks/useSettings";
import { BYOK_MODELS, CUSTOM_MODEL_ID, TRUERECALL_WEB_URL, } from "@true-recall/core/constants";
import { Clickable, FormCard, FormField, InfoBlock, SelectInput, SliderInput, TextAreaInput, TextInput, ToggleInput, } from "@true-recall/obsidian/components";
import { requestUrl } from "obsidian";
import { useEffect, useState } from "preact/hooks";
const MODEL_OPTIONS = [
    ...BYOK_MODELS.map((m) => ({
        value: m.id,
        label: `${m.name} (${m.provider})${m.recommended ? " — Recommended" : ""}`,
    })),
    { value: CUSTOM_MODEL_ID, label: "Custom..." },
];
function getModelDefault(modelId) {
    var _a, _b;
    return (_b = (_a = BYOK_MODELS.find((m) => m.id === modelId)) === null || _a === void 0 ? void 0 : _a.defaultTemperature) !== null && _b !== void 0 ? _b : 0.7;
}
// Cache so we only hit the network when the key actually changes
let cachedKey;
let cachedStatus = "idle";
function verifyProKey(key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield requestUrl({
                url: "https://ai.truerecall.app/key/info",
                headers: { Authorization: `Bearer ${key}` },
            });
            return res.status === 200;
        }
        catch (_a) {
            return false;
        }
    });
}
export function AITab() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { settings, save } = useSettings();
    const initialStatus = settings.proKey && settings.proKey === cachedKey ? cachedStatus : "idle";
    const [keyStatus, setKeyStatus] = useState(initialStatus);
    const hasProKey = !!settings.proKey;
    const currentModel = settings.aiModel || ((_a = BYOK_MODELS[0]) === null || _a === void 0 ? void 0 : _a.id) || "";
    const modelDefault = getModelDefault(currentModel);
    const effectiveTemp = (_b = settings.aiTemperature) !== null && _b !== void 0 ? _b : modelDefault;
    useEffect(() => {
        if (!settings.proKey) {
            cachedKey = undefined;
            cachedStatus = "idle";
            setKeyStatus("idle");
            return;
        }
        if (settings.proKey === cachedKey && cachedStatus !== "idle") {
            setKeyStatus(cachedStatus);
            return;
        }
        setKeyStatus("checking");
        const key = settings.proKey;
        void verifyProKey(key).then((ok) => {
            const status = ok ? "valid" : "invalid";
            cachedKey = key;
            cachedStatus = status;
            setKeyStatus(status);
        });
    }, [settings.proKey]);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [_jsxs(FormCard, { title: "True Recall Pro", children: [_jsx(FormField, { name: "Pro Key", description: _jsxs("span", { children: ["Get your key at", " ", _jsx("a", { href: `${TRUERECALL_WEB_URL}/dashboard`, class: "ep:text-obs-accent", children: "truerecall.app/dashboard" })] }), children: _jsx(TextInput, { value: (_c = settings.proKey) !== null && _c !== void 0 ? _c : "", onChange: (v) => void save({ proKey: v.trim().length > 0 ? v.trim() : undefined }), type: "password", placeholder: "Paste key from dashboard", class: "ep:w-[300px]" }) }), keyStatus === "checking" && _jsx(InfoBlock, { children: "Verifying key\u2026" }), keyStatus === "valid" && (_jsx(InfoBlock, { children: "Active \u2014 AI routed via True Recall servers." })), keyStatus === "invalid" && (_jsxs(InfoBlock, { class: "ep:text-obs-error", children: ["Invalid key \u2014 check your key on the", " ", _jsx("a", { href: `${TRUERECALL_WEB_URL}/dashboard`, class: "ep:text-obs-accent", children: "dashboard" }), "."] })), _jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:pt-2 ep:mt-2 ep:border-t ep:border-obs-modifier-border", children: [_jsx("p", { class: "ep:font-medium ep:text-obs-normal", children: "Zero setup, optimized results" }), _jsx("p", { class: "ep:mt-1", children: "Optimized prompts and model selection managed server-side. AI budget included with your subscription." })] })] }), _jsxs(FormCard, { title: "OpenRouter API Key", children: [_jsx(FormField, { name: "OpenRouter API key", description: "Your own API key \u2014 you pay OpenRouter directly per token. Also used as fallback when Pro budget is exhausted.", children: _jsx(TextInput, { value: settings.openRouterApiKey, onChange: (v) => void save({ openRouterApiKey: v }), type: "password", placeholder: "Enter API key", class: "ep:w-[300px]" }) }), _jsx(FormField, { name: "Model", description: "Reasoning model used for flashcard generation.", children: _jsx(SelectInput, { value: currentModel, onChange: (v) => void save({ aiModel: v, aiTemperature: undefined }), options: MODEL_OPTIONS }) }), currentModel === CUSTOM_MODEL_ID && (_jsx(FormField, { name: "Custom Model ID", description: "Enter any OpenRouter-compatible model ID.", children: _jsx(TextInput, { value: (_d = settings.customAiModel) !== null && _d !== void 0 ? _d : "", onChange: (v) => void save({ customAiModel: v }), placeholder: "e.g. openai/gpt-4o-mini", class: "ep:w-[300px]" }) })), _jsx(FormField, { name: "Temperature", description: _jsxs("span", { children: ["Controls randomness.", " ", settings.aiTemperature != null ? (_jsxs(Clickable, { class: "ep:text-obs-accent ep:text-ui-smaller", onClick: () => void save({ aiTemperature: undefined }), children: ["Reset to model default (", modelDefault, ")"] })) : (_jsxs("span", { class: "ep:text-obs-muted", children: ["Using model default (", modelDefault, ")"] }))] }), children: _jsx(SliderInput, { value: effectiveTemp, onChange: (v) => void save({ aiTemperature: v }), min: 0, max: 2, step: 0.1, formatTooltip: (v) => v.toFixed(1) }) })] }), _jsxs(FormCard, { title: "AI Prompts", children: [_jsx(FormField, { name: "Generation prompt", description: hasProKey
                            ? "Extra instructions for flashcard generation. Pro already uses an optimized prompt — leave empty unless you want to override specific behavior."
                            : "Extra instructions for flashcard generation. Added to the system prompt alongside JSON format rules.", children: _jsx(TextAreaInput, { value: (_e = settings.aiGenerationPrompt) !== null && _e !== void 0 ? _e : "", onChange: (v) => void save({
                                aiGenerationPrompt: v.trim().length > 0 ? v : undefined,
                            }), placeholder: hasProKey
                                ? "Leave empty for best results"
                                : "e.g. Focus on key definitions and formulas", rows: 4, class: "ep:w-full ep:font-mono ep:text-ui-smaller" }) }), _jsx(FormField, { name: "Type-in grading prompt", description: "Optional custom system prompt for AI answer grading during review type-in mode. Leave empty to use built-in prompt.", children: _jsx(TextAreaInput, { value: (_f = settings.aiTypeInGradingPrompt) !== null && _f !== void 0 ? _f : "", onChange: (v) => void save({
                                aiTypeInGradingPrompt: v.trim().length > 0 ? v : undefined,
                            }), rows: 6, class: "ep:w-full ep:font-mono ep:text-ui-smaller" }) }), _jsx(FormField, { name: "Image occlusion detection prompt", description: "Custom prompt for AI region detection in image occlusion. Leave empty to use built-in prompt.", children: _jsx(TextAreaInput, { value: (_g = settings.aiIODetectionPrompt) !== null && _g !== void 0 ? _g : "", onChange: (v) => void save({
                                aiIODetectionPrompt: v.trim().length > 0 ? v : undefined,
                            }), rows: 4, class: "ep:w-full ep:font-mono ep:text-ui-smaller" }) })] }), _jsxs(FormCard, { title: "Flashcard Generation", children: [_jsx(FormField, { name: "Generation language", description: "Language for AI-generated flashcards. Auto-detect matches the source text language.", children: _jsx(SelectInput, { value: (_h = settings.generationLanguage) !== null && _h !== void 0 ? _h : "auto", onChange: (v) => void save({ generationLanguage: v }), options: [...GENERATION_LANGUAGES] }) }), _jsx(FormField, { name: "Selection toolbar", description: "Show a floating toolbar above selected text for AI-powered flashcard creation.", children: _jsx(ToggleInput, { value: settings.selectionToolbarEnabled, onChange: (v) => void save({ selectionToolbarEnabled: v }) }) })] })] }));
}
