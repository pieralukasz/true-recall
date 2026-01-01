/**
 * Plugin settings types
 */

import type { AIModelKey } from "../constants";

// Plugin settings interface
export interface ShadowAnkiSettings {
    openRouterApiKey: string;
    aiModel: AIModelKey;
    flashcardsFolder: string;
    autoSyncToAnki: boolean;
    storeSourceContent: boolean;
}
