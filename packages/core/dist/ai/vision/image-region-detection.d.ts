import type { IHttpClient } from "../../interfaces/http-client";
import type { IORegion } from "../../types/image-occlusion.types";
import type { TrueRecallSettings } from "../../types/settings.types";
export declare function getMimeType(extension: string): string;
export declare function parseAIRegions(responseText: string): IORegion[];
export interface DetectRegionsOptions {
    base64: string;
    mimeType: string;
    settings: TrueRecallSettings;
    httpClient: IHttpClient;
    customHint?: string;
    settingsPrompt?: string;
}
export declare function detectRegionsFromImage(options: DetectRegionsOptions): Promise<IORegion[]>;
