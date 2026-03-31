import { __awaiter } from "tslib";
import { TFile } from "obsidian";
export class ObsidianFrontmatter {
    constructor(app) {
        this.app = app;
    }
    read(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile))
                return {};
            const cache = this.app.metadataCache.getFileCache(file);
            return (_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) !== null && _a !== void 0 ? _a : {};
        });
    }
    update(filePath, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile))
                return;
            yield this.app.fileManager.processFrontMatter(file, (fm) => {
                Object.assign(fm, changes);
            });
        });
    }
}
