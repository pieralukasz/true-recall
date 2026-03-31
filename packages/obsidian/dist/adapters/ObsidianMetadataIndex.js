import { TFile } from "obsidian";
export class ObsidianMetadataIndex {
    constructor(app) {
        this.app = app;
    }
    getPathByFieldValue(field, value) {
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const fm = cache === null || cache === void 0 ? void 0 : cache.frontmatter;
            if (fm && String(fm[field]) === value) {
                return file.path;
            }
        }
        return null;
    }
    getFieldValue(path, field) {
        var _a;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile))
            return undefined;
        const cache = this.app.metadataCache.getFileCache(file);
        return (_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) === null || _a === void 0 ? void 0 : _a[field];
    }
    getAllPathsWithField(field) {
        const result = new Map();
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const fm = cache === null || cache === void 0 ? void 0 : cache.frontmatter;
            if (fm && field in fm) {
                result.set(file.path, fm[field]);
            }
        }
        return result;
    }
    onFieldChange(field, callback) {
        var _a;
        // Track current values so we can detect changes
        const tracked = new Map();
        // Initialize tracked values
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            const value = (_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) === null || _a === void 0 ? void 0 : _a[field];
            if (value !== undefined) {
                tracked.set(file.path, value);
            }
        }
        const ref = this.app.metadataCache.on("changed", (file, _data, cache) => {
            var _a;
            const newValue = (_a = cache.frontmatter) === null || _a === void 0 ? void 0 : _a[field];
            const oldValue = tracked.get(file.path);
            if (oldValue !== newValue) {
                if (newValue !== undefined) {
                    tracked.set(file.path, newValue);
                }
                else {
                    tracked.delete(file.path);
                }
                callback(file.path, oldValue, newValue);
            }
        });
        return () => {
            this.app.metadataCache.offref(ref);
        };
    }
}
