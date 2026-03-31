import { __awaiter } from "tslib";
import { normalizePath } from "obsidian";
/**
 * Reads vault files for the AnkiMediaService.
 */
export class ObsidianVaultFileReader {
    constructor(app) {
        this.app = app;
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            return yield this.app.vault.adapter.exists(normalized);
        });
    }
    readBinary(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            return yield this.app.vault.adapter.readBinary(normalized);
        });
    }
    findByName(filename) {
        var _a;
        const allFiles = this.app.vault.getFiles();
        const found = allFiles.find((f) => f.name === filename);
        return (_a = found === null || found === void 0 ? void 0 : found.path) !== null && _a !== void 0 ? _a : null;
    }
}
