import { __awaiter } from "tslib";
import { detectRegionsFromImage, getMimeType, } from "@true-recall/core/ai/vision/image-region-detection";
import { TFile } from "obsidian";
import { ObsidianHttpClient } from "../../adapters/ObsidianHttpClient";
export function imageToBase64(app, imagePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const file = app.vault.getAbstractFileByPath(imagePath);
        if (!(file instanceof TFile))
            throw new Error("Image file not found");
        const arrayBuffer = yield app.vault.readBinary(file);
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        const base64 = btoa(binary);
        const mimeType = getMimeType(file.extension);
        return { base64, mimeType };
    });
}
export function detectRegions(app, imagePath, settings, customHint, settingsPrompt) {
    return __awaiter(this, void 0, void 0, function* () {
        const { base64, mimeType } = yield imageToBase64(app, imagePath);
        return detectRegionsFromImage({
            base64,
            mimeType,
            settings,
            httpClient: new ObsidianHttpClient(),
            customHint,
            settingsPrompt,
        });
    });
}
