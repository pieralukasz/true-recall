/**
 * Resolves flashcard_uid → note name by scanning the vault's metadata cache.
 */
export class ObsidianSourceUidResolver {
    constructor(app) {
        this.app = app;
    }
    resolveSourceUids() {
        const map = new Map();
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!(cache === null || cache === void 0 ? void 0 : cache.frontmatter))
                continue;
            const uid = cache.frontmatter.flashcard_uid;
            if (!uid)
                continue;
            map.set(uid, { name: file.basename });
        }
        return map;
    }
}
