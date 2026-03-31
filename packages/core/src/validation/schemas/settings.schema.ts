import { z } from "zod";
import { BYOK_MODELS } from "../../constants";

const modelIds = BYOK_MODELS.map((m) => m.id) as [string, ...string[]];

export const AIModelSchema = z.enum(modelIds).or(z.string());

export const AITierSchema = z.enum(["pro", "byok"]).default("byok");

export const SettingsSchema = z.object({
	proKey: z.string().optional(),
	openRouterApiKey: z.string(),
	aiModel: AIModelSchema,
	customAiModel: z.string().optional(),
	aiTier: AITierSchema,
	autoSyncToAnki: z.boolean().default(false),
	selectionToolbarEnabled: z.boolean().default(true),
	aiGenerationPrompt: z.string().optional(),
});

export const PartialSettingsSchema = SettingsSchema.partial();

export const SettingsWithApiKeySchema = SettingsSchema.refine(
	(data) =>
		(data.proKey?.trim().length ?? 0) > 0 ||
		data.openRouterApiKey.trim().length > 0,
	{
		message: "API key is required",
		path: ["openRouterApiKey"],
	},
);

export type AIModel = z.infer<typeof AIModelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type PartialSettings = z.infer<typeof PartialSettingsSchema>;
