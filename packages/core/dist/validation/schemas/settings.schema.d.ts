import { z } from "zod";
export declare const AIModelSchema: z.ZodUnion<[z.ZodEnum<{
    [x: string]: string;
}>, z.ZodString]>;
export declare const AITierSchema: z.ZodDefault<z.ZodEnum<{
    pro: "pro";
    byok: "byok";
}>>;
export declare const SettingsSchema: z.ZodObject<{
    proKey: z.ZodOptional<z.ZodString>;
    openRouterApiKey: z.ZodString;
    aiModel: z.ZodUnion<[z.ZodEnum<{
        [x: string]: string;
    }>, z.ZodString]>;
    customAiModel: z.ZodOptional<z.ZodString>;
    aiTier: z.ZodDefault<z.ZodEnum<{
        pro: "pro";
        byok: "byok";
    }>>;
    autoSyncToAnki: z.ZodDefault<z.ZodBoolean>;
    selectionToolbarEnabled: z.ZodDefault<z.ZodBoolean>;
    aiGenerationPrompt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const PartialSettingsSchema: z.ZodObject<{
    proKey: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    openRouterApiKey: z.ZodOptional<z.ZodString>;
    aiModel: z.ZodOptional<z.ZodUnion<[z.ZodEnum<{
        [x: string]: string;
    }>, z.ZodString]>>;
    customAiModel: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    aiTier: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        pro: "pro";
        byok: "byok";
    }>>>;
    autoSyncToAnki: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    selectionToolbarEnabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    aiGenerationPrompt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const SettingsWithApiKeySchema: z.ZodObject<{
    proKey: z.ZodOptional<z.ZodString>;
    openRouterApiKey: z.ZodString;
    aiModel: z.ZodUnion<[z.ZodEnum<{
        [x: string]: string;
    }>, z.ZodString]>;
    customAiModel: z.ZodOptional<z.ZodString>;
    aiTier: z.ZodDefault<z.ZodEnum<{
        pro: "pro";
        byok: "byok";
    }>>;
    autoSyncToAnki: z.ZodDefault<z.ZodBoolean>;
    selectionToolbarEnabled: z.ZodDefault<z.ZodBoolean>;
    aiGenerationPrompt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AIModel = z.infer<typeof AIModelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type PartialSettings = z.infer<typeof PartialSettingsSchema>;
