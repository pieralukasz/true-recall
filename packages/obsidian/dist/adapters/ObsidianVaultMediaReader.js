import { __awaiter } from "tslib";
/**
 * Reads binary media files from the Obsidian vault.
 */
export class ObsidianVaultMediaReader {
    constructor(app) {
        this.app = app;
    }
    readBinaryByName(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.vault
                .getFiles()
                .find((f) => f.name === filename || f.path.endsWith(`/${filename}`));
            if (!file)
                return null;
            try {
                return yield this.app.vault.readBinary(file);
            }
            catch (_a) {
                console.error(`[True Recall] Could not read media file: ${filename}`);
                return null;
            }
        });
    }
}
