/**
 * Resolves source note info using IFileSystem and IMetadataIndex for O(1) lookups.
 * Platform-agnostic replacement for Obsidian vault/metadataCache usage.
 */
import { __awaiter } from "tslib";
import { FrontmatterService } from "./frontmatter.service";
export class SourceNoteService {
    constructor(fileSystem, frontmatter, metadataIndex) {
        // Fallback cache for when IMetadataIndex is not available
        // Built lazily on first access, invalidated on vault changes
        this.fallbackUidCache = null;
        this.fallbackCacheBuilt = false;
        this.frontmatterService = new FrontmatterService(fileSystem, frontmatter);
        this.metadataIndex = metadataIndex !== null && metadataIndex !== void 0 ? metadataIndex : null;
    }
    getOrCreateSourceUid(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            let uid = yield this.frontmatterService.getSourceNoteUid(filePath);
            if (!uid) {
                uid = this.frontmatterService.generateUid();
                yield this.frontmatterService.setSourceNoteUid(filePath, uid);
            }
            return uid;
        });
    }
    getSourceUid(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.frontmatterService.getSourceNoteUid(filePath);
        });
    }
    setSourceUid(filePath, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.frontmatterService.setSourceNoteUid(filePath, uid);
        });
    }
    resolveSourceNote(sourceUid) {
        if (!sourceUid) {
            return {};
        }
        const path = this.findPathByUidSync(sourceUid);
        if (!path) {
            return {};
        }
        // Extract basename from path
        const lastSlash = path.lastIndexOf("/");
        const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
        const basename = filename.replace(/\.md$/, "");
        return {
            noteName: basename,
            notePath: path,
        };
    }
    getSourceNotePath(notePath) {
        // In the platform-agnostic version, we just validate the path exists
        // by checking if the metadata index has it
        if (this.metadataIndex) {
            const uid = this.metadataIndex.getFieldValue(notePath, "flashcard_uid");
            return uid !== undefined ? notePath : null;
        }
        return notePath;
    }
    findSourceNoteByUid(uid) {
        return this.findPathByUidSync(uid);
    }
    findPathByUidSync(uid) {
        var _a, _b;
        // O(1) lookup via index (preferred)
        if (this.metadataIndex) {
            return this.metadataIndex.getPathByFieldValue("flashcard_uid", uid);
        }
        // Fallback: Use cached Map (built once, O(1) lookups after)
        if (!this.fallbackCacheBuilt) {
            this.buildFallbackCache();
        }
        return (_b = (_a = this.fallbackUidCache) === null || _a === void 0 ? void 0 : _a.get(uid)) !== null && _b !== void 0 ? _b : null;
    }
    buildFallbackCache() {
        console.error("[SourceNoteService] MetadataIndex not available, building fallback cache");
        this.fallbackUidCache = new Map();
        if (this.metadataIndex) {
            const allPaths = this.metadataIndex.getAllPathsWithField("flashcard_uid");
            for (const [path, value] of allPaths) {
                if (typeof value === "string") {
                    this.fallbackUidCache.set(value, path);
                }
            }
        }
        this.fallbackCacheBuilt = true;
    }
    invalidateFallbackCache() {
        this.fallbackUidCache = null;
        this.fallbackCacheBuilt = false;
    }
    hasFlashcards(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const uid = yield this.getSourceUid(filePath);
            return uid !== null;
        });
    }
    enrichCard(card) {
        if (!card.sourceUid) {
            return Object.assign(Object.assign({}, card), { sourceNoteName: "", sourceNotePath: "" });
        }
        const path = this.findPathByUidSync(card.sourceUid);
        if (!path) {
            return Object.assign(Object.assign({}, card), { sourceNoteName: "", sourceNotePath: "" });
        }
        const lastSlash = path.lastIndexOf("/");
        const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
        const basename = filename.replace(/\.md$/, "");
        return Object.assign(Object.assign({}, card), { sourceNoteName: basename, sourceNotePath: path });
    }
    enrichCards(cards) {
        return cards.map((card) => this.enrichCard(card));
    }
    /**
     * In-place enrichment for scheduling metadata.
     * Mutates the objects directly to avoid spread-copy overhead on large arrays.
     */
    enrichMeta(meta) {
        if (!meta.sourceUid) {
            meta.sourceNoteName = "";
            meta.sourceNotePath = "";
            return meta;
        }
        const path = this.findPathByUidSync(meta.sourceUid);
        if (!path) {
            meta.sourceNoteName = "";
            meta.sourceNotePath = "";
            return meta;
        }
        const lastSlash = path.lastIndexOf("/");
        const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
        meta.sourceNoteName = filename.replace(/\.md$/, "");
        meta.sourceNotePath = path;
        return meta;
    }
    enrichMetas(metas) {
        for (const meta of metas) {
            this.enrichMeta(meta);
        }
        return metas;
    }
}
