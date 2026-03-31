import { BYOK_MODELS, CUSTOM_MODEL_ID, DEFAULT_BYOK_MODEL, LITELLM_URL, } from "../../constants";
import { OPENROUTER_URL } from "../clients/openrouter-client";
const PRO_MODEL = "auto";
function resolveByokTemperature(settings) {
    var _a;
    if (settings.aiTemperature != null)
        return settings.aiTemperature;
    const model = BYOK_MODELS.find((m) => m.id === settings.aiModel);
    return (_a = model === null || model === void 0 ? void 0 : model.defaultTemperature) !== null && _a !== void 0 ? _a : 0.7;
}
export function resolveAIClientConfig(settings) {
    if (settings.proKey) {
        return {
            apiKey: settings.proKey,
            model: PRO_MODEL,
            baseUrl: LITELLM_URL,
            isPro: true,
            temperature: 0.7,
        };
    }
    if (settings.openRouterApiKey) {
        const model = settings.aiModel === CUSTOM_MODEL_ID
            ? settings.customAiModel || DEFAULT_BYOK_MODEL
            : settings.aiModel || DEFAULT_BYOK_MODEL;
        return {
            apiKey: settings.openRouterApiKey,
            model,
            baseUrl: OPENROUTER_URL,
            isPro: false,
            temperature: resolveByokTemperature(settings),
        };
    }
    throw new Error("No AI key configured. Add your Pro key or OpenRouter API key in settings.");
}
export function hasAIKey(settings) {
    return !!(settings.proKey || settings.openRouterApiKey);
}
