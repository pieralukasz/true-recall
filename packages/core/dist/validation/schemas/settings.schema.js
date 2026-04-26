import { z } from "zod";
import { BYOK_MODELS } from "../../constants";
const modelIds = BYOK_MODELS.map((m) => m.id);
export const AIModelSchema = z.enum(modelIds).or(z.string());
const AITierSchema = z.enum(["pro", "byok"]).default("byok");
export const SettingsSchema = z.object({
    proKey: z.string().optional(),
    openRouterApiKey: z.string(),
    aiModel: AIModelSchema,
    customAiModel: z.string().optional(),
    aiTier: AITierSchema,
    autoSyncToAnki: z.boolean().default(false),
    aiGenerationPrompt: z.string().optional(),
});
export const PartialSettingsSchema = SettingsSchema.partial();
export const SettingsWithApiKeySchema = SettingsSchema.refine((data) => {
    var _a, _b;
    return ((_b = (_a = data.proKey) === null || _a === void 0 ? void 0 : _a.trim().length) !== null && _b !== void 0 ? _b : 0) > 0 ||
        data.openRouterApiKey.trim().length > 0;
}, {
    message: "API key is required",
    path: ["openRouterApiKey"],
});
