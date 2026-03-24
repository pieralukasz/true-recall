import { AI_MODELS } from "@shared/constants";
import { z } from "zod";

const modelKeys = Object.keys(AI_MODELS) as [string, ...string[]];

export const AIModelSchema = z.enum(modelKeys);

const AiFlashcardPromptsSchema = z
	.object({
		basic: z.string().optional(),
		cloze: z.string().optional(),
		reversed: z.string().optional(),
		auto: z.string().optional(),
	})
	.optional();

export const AITierSchema = z.enum(["byok"]).default("byok");

export const SettingsSchema = z.object({
	openRouterApiKey: z.string(),
	aiModel: AIModelSchema,
	aiTier: AITierSchema,
	autoSyncToAnki: z.boolean().default(false),
	selectionToolbarEnabled: z.boolean().default(true),
	aiFlashcardPrompts: AiFlashcardPromptsSchema,
});

export const PartialSettingsSchema = SettingsSchema.partial();

export const SettingsWithApiKeySchema = SettingsSchema.refine(
	(data) => data.openRouterApiKey.trim().length > 0,
	{
		message: "API key is required",
		path: ["openRouterApiKey"],
	},
);

export type AIModel = z.infer<typeof AIModelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type PartialSettings = z.infer<typeof PartialSettingsSchema>;
