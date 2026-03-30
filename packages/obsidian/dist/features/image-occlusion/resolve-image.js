import { normalizeIOImagePath } from "@true-recall/core/utils/io-definition";
import { isImageExtension } from "@true-recall/core/types";
import { TFile } from "obsidian";
export function resolveImageFile(app, imagePath) {
    var _a;
    const normalized = normalizeIOImagePath(imagePath);
    if (!normalized)
        return null;
    const direct = app.vault.getAbstractFileByPath(normalized);
    if (direct instanceof TFile && isImageExtension(direct.extension)) {
        return direct;
    }
    const filename = (_a = normalized.split("/").pop()) !== null && _a !== void 0 ? _a : normalized;
    const byName = app.vault
        .getFiles()
        .find((file) => isImageExtension(file.extension) && file.name === filename);
    return byName !== null && byName !== void 0 ? byName : null;
}
