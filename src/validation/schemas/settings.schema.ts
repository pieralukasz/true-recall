/**
 * Zod schemas for plugin settings
 */
import { z } from "zod";
import { AI_MODELS } from "../../constants";

// ===== AI Model Schema =====

// Extract model keys from AI_MODELS
const modelKeys = Object.keys(AI_MODELS) as [string, ...string[]];

/**
 * Schema for AI model selection
 */
export const AIModelSchema = z.enum(modelKeys);

// ===== Settings Schema =====

/**
 * Schema for complete plugin settings
 */
export const SettingsSchema = z.object({
    openRouterApiKey: z.string(),
    aiModel: AIModelSchema,
    autoSyncToAnki: z.boolean().default(false),
    // Custom prompts (empty string = use default)
    customGeneratePrompt: z.string().default(""),
    customUpdatePrompt: z.string().default(""),
});

/**
 * Schema for partial settings (for updates)
 */
export const PartialSettingsSchema = SettingsSchema.partial();

/**
 * Schema for settings with API key validation
 */
export const SettingsWithApiKeySchema = SettingsSchema.refine(
    (data) => data.openRouterApiKey.trim().length > 0,
    {
        message: "API key is required",
        path: ["openRouterApiKey"],
    }
);

// ===== Inferred Types from Schemas =====

export type AIModel = z.infer<typeof AIModelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type PartialSettings = z.infer<typeof PartialSettingsSchema>;
