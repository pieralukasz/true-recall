import { __awaiter } from "tslib";
import { normalizePath } from "obsidian";
/**
 * Implements vault operations needed by AnkiImportService using Obsidian's API.
 */
export class ObsidianAnkiImportVault {
    constructor(app) {
        this.app = app;
    }
    exists(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            return this.app.vault.getAbstractFileByPath(normalized) !== null;
        });
    }
    ensureFolderRecursive(folderPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const parts = folderPath.split("/");
            let current = "";
            for (const part of parts) {
                current = current ? `${current}/${part}` : part;
                const normalized = normalizePath(current);
                if (!this.app.vault.getAbstractFileByPath(normalized)) {
                    yield this.app.vault.createFolder(normalized);
                }
            }
        });
    }
    createFile(path, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            yield this.app.vault.create(normalized, content);
        });
    }
    readFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            const file = this.app.vault.getAbstractFileByPath(normalized);
            if (!file)
                throw new Error(`File not found: ${path}`);
            return yield this.app.vault.read(file);
        });
    }
    appendToFile(path, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            const file = this.app.vault.getAbstractFileByPath(normalized);
            if (!file)
                throw new Error(`File not found: ${path}`);
            yield this.app.vault.process(file, (existing) => `${existing}${content}`);
        });
    }
    prependToFile(path, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            const file = this.app.vault.getAbstractFileByPath(normalized);
            if (!file)
                throw new Error(`File not found: ${path}`);
            yield this.app.vault.process(file, (existing) => `${content}${existing}`);
        });
    }
    getFrontmatterUid(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const normalized = normalizePath(path);
            const file = this.app.vault.getAbstractFileByPath(normalized);
            if (!file)
                return null;
            const cache = this.app.metadataCache.getFileCache(file);
            return (_b = (_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) === null || _a === void 0 ? void 0 : _a.flashcard_uid) !== null && _b !== void 0 ? _b : null;
        });
    }
    addParentToFrontmatter(path, parentName) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalized = normalizePath(path);
            const file = this.app.vault.getAbstractFileByPath(normalized);
            if (!file)
                return;
            yield this.app.fileManager.processFrontMatter(file, (fm) => {
                const existing = Array.isArray(fm.parents)
                    ? fm.parents
                    : [];
                const names = new Set(existing.map((p) => p.replace(/^\[\[|\]\]$/g, "")));
                if (!names.has(parentName)) {
                    existing.push(`[[${parentName}]]`);
                    fm.parents = existing;
                }
            });
        });
    }
}
