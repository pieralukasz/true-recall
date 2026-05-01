import { z } from "zod";

import { BYOK_MODELS } from "../../constants";

const modelIds = BYOK_MODELS.map((m) => m.id) as [string, ...string[]];

export const AIModelSchema = z.enum(modelIds).or(z.string());

export const AITierSchema = z
	.enum(["pro", "byok", "custom", "lmstudio"])
	.default("byok");

export const AIProviderTypeSchema = z
	.enum(["pro", "openrouter", "custom", "lmstudio"])
	.default("openrouter");

export const SettingsSchema = z.object({
	proKey: z.string().optional(),
	openRouterApiKey: z.string(),
	aiModel: AIModelSchema,
	customAiModel: z.string().optional(),
	aiTier: AITierSchema,
	providerType: AIProviderTypeSchema,
	customBaseUrl: z.string().default("http://localhost:11434/v1"),
	customApiKey: z.string().optional(),
	customModel: z.string().default(""),
	customTemperature: z.number().min(0).max(2).optional(),
	lmStudioBaseUrl: z.string().default("http://localhost:1234/v1"),
	lmStudioModel: z.string().default(""),
	lmStudioApiKey: z.string().optional(),
	lmStudioTemperature: z.number().min(0).max(2).optional(),
	autoSyncToAnki: z.boolean().default(false),
	aiGenerationPrompt: z.string().optional(),
});

export const PartialSettingsSchema = SettingsSchema.partial();

export const SettingsWithApiKeySchema = SettingsSchema.refine(
	(data) => {
		switch (data.providerType) {
			case "pro":
				return (data.proKey?.trim().length ?? 0) > 0;
			case "lmstudio":
				return data.lmStudioModel.trim().length > 0;
			case "custom":
				return data.customModel.trim().length > 0;
			// biome-ignore lint/complexity/noUselessSwitchCase: openrouter is the documented default
			case "openrouter":
			default:
				return data.openRouterApiKey.trim().length > 0;
		}
	},
	{
		message: "API key or model name is required for the selected provider",
		path: ["openRouterApiKey"],
	},
);

export type AIModel = z.infer<typeof AIModelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type PartialSettings = z.infer<typeof PartialSettingsSchema>;
