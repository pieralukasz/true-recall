import type { TrueRecallSettings } from "../../types/settings.types";
export interface AIClientConfig {
    apiKey: string;
    model: string;
    baseUrl: string;
    isPro: boolean;
    temperature: number;
}
export declare function resolveAIClientConfig(settings: TrueRecallSettings): AIClientConfig;
export declare function hasAIKey(settings: TrueRecallSettings): boolean;
