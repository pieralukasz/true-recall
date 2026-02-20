import { AI_MODELS } from "@shared/constants";
import { z } from "zod";

const modelKeys = Object.keys(AI_MODELS) as [string, ...string[]];

export const AIModelSchema = z.enum(modelKeys);

export const SettingsSchema = z.object({
	openRouterApiKey: z.string(),
	aiModel: AIModelSchema,
	autoSyncToAnki: z.boolean().default(false),
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
