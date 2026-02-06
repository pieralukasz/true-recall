import { z } from "zod";
import { AI_MODELS } from "../../constants";

const modelKeys = Object.keys(AI_MODELS) as [string, ...string[]];

export const AIModelSchema = z.enum(modelKeys);

export const SettingsSchema = z.object({
    openRouterApiKey: z.string(),
    aiModel: AIModelSchema,
    autoSyncToAnki: z.boolean().default(false),
    // Custom prompts (empty string = use default)
    customGeneratePrompt: z.string().default(""),
    customUpdatePrompt: z.string().default(""),
});

export const PartialSettingsSchema = SettingsSchema.partial();

export const SettingsWithApiKeySchema = SettingsSchema.refine(
    (data) => data.openRouterApiKey.trim().length > 0,
    {
        message: "API key is required",
        path: ["openRouterApiKey"],
    }
);

export type AIModel = z.infer<typeof AIModelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type PartialSettings = z.infer<typeof PartialSettingsSchema>;
