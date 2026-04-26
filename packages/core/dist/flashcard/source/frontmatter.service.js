import { __awaiter } from "tslib";
export class FrontmatterService {
    constructor(fileSystem, frontmatter) {
        this.fileSystem = fileSystem;
        this.frontmatter = frontmatter;
        /** UID field name in source note frontmatter */
        this.SOURCE_UID_FIELD = "flashcard_uid";
        /** UID length for generating short IDs */
        this.UID_LENGTH = 8;
    }
    extractSourceLinkFromContent(content) {
        var _a;
        const match = content.match(FrontmatterService.SOURCE_LINK_REGEX);
        return (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : null;
    }
    extractAllTags(content) {
        var _a, _b, _c, _d;
        const tags = [];
        // Extract inline tags
        const inlineMatches = content.match(FrontmatterService.INLINE_TAG_REGEX);
        if (inlineMatches) {
            tags.push(...inlineMatches.map((t) => t.replace(/^#/, "")));
        }
        // Extract frontmatter tags
        const frontmatterMatch = content.match(FrontmatterService.FRONTMATTER_REGEX);
        if (frontmatterMatch) {
            const frontmatter = (_a = frontmatterMatch[1]) !== null && _a !== void 0 ? _a : "";
            // Array format: tags: [science, history]
            const tagsArrayMatch = frontmatter.match(FrontmatterService.TAGS_ARRAY_REGEX);
            if (tagsArrayMatch) {
                const arrayTags = (_c = (_b = tagsArrayMatch[1]) === null || _b === void 0 ? void 0 : _b.split(",").map((t) => t.trim().replace(/^["']|["']$/g, ""))) !== null && _c !== void 0 ? _c : [];
                tags.push(...arrayTags);
            }
            // List format: tags:\n  - science
            const tagsListMatch = frontmatter.match(FrontmatterService.TAGS_LIST_REGEX);
            if (tagsListMatch) {
                const tagLines = (_d = tagsListMatch[0].match(/-\s+(\S+)/g)) !== null && _d !== void 0 ? _d : [];
                const listTags = tagLines.map((t) => t.replace(/^-\s+/, "").replace(/^["']|["']$/g, ""));
                tags.push(...listTags);
            }
        }
        return tags;
    }
    /**
     * Generate a short UID for flashcard linking (8 hex chars)
     */
    generateUid() {
        return crypto.randomUUID().replace(/-/g, "").slice(0, this.UID_LENGTH);
    }
    getSourceNoteUid(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const p = typeof filePath === "string" ? filePath : filePath.path;
            const content = yield this.fileSystem.read(p);
            const match = content.match(FrontmatterService.UID_FIELD_REGEX);
            return (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : null;
        });
    }
    setSourceNoteUid(filePath, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const p = typeof filePath === "string" ? filePath : filePath.path;
            yield this.frontmatter.update(p, {
                [this.SOURCE_UID_FIELD]: uid,
            });
        });
    }
    setArchive(filePath, archived) {
        return __awaiter(this, void 0, void 0, function* () {
            if (archived) {
                yield this.frontmatter.update(filePath, { archive: true });
            }
            else {
                yield this.frontmatter.update(filePath, { archive: undefined });
            }
        });
    }
    setFsrsPreset(filePath, presetName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (presetName) {
                yield this.frontmatter.update(filePath, { fsrs_preset: presetName });
            }
            else {
                yield this.frontmatter.update(filePath, { fsrs_preset: undefined });
            }
        });
    }
    addParent(filePath, parentName) {
        return __awaiter(this, void 0, void 0, function* () {
            const fm = yield this.frontmatter.read(filePath);
            const existing = Array.isArray(fm.parents)
                ? fm.parents
                : [];
            const names = new Set(existing.map((p) => p.replace(/^\[\[|\]\]$/g, "")));
            if (!names.has(parentName)) {
                existing.push(`[[${parentName}]]`);
            }
            yield this.frontmatter.update(filePath, { parents: existing });
        });
    }
    removeParent(filePath, parentName) {
        return __awaiter(this, void 0, void 0, function* () {
            const fm = yield this.frontmatter.read(filePath);
            const existing = Array.isArray(fm.parents)
                ? fm.parents
                : [];
            const filtered = existing.filter((p) => p.replace(/^\[\[|\]\]$/g, "") !== parentName);
            if (filtered.length === 0) {
                yield this.frontmatter.update(filePath, { parents: undefined });
            }
            else {
                yield this.frontmatter.update(filePath, { parents: filtered });
            }
        });
    }
    dissolveProject(childPaths, parentName) {
        return __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            for (const childPath of childPaths) {
                yield this.removeParent(childPath, parentName);
                count++;
            }
            return count;
        });
    }
    markAsProject(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.frontmatter.update(filePath, { project: true });
        });
    }
    unmarkProject(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.frontmatter.update(filePath, { project: undefined });
        });
    }
    moveChildren(childPaths, fromParent, toParent) {
        return __awaiter(this, void 0, void 0, function* () {
            let count = 0;
            for (const childPath of childPaths) {
                yield this.removeParent(childPath, fromParent);
                yield this.addParent(childPath, toParent);
                count++;
            }
            return count;
        });
    }
    /**
     * Remove "# Flashcards for [[...]]" header from content
     * Used for migration of existing files
     */
    removeFlashcardsHeader(content) {
        return content.replace(/^# Flashcards for \[\[.+?\]\]\n\n?/m, "");
    }
}
/** Matches YAML frontmatter block */
FrontmatterService.FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
/** Matches inline tags: #tag/subtag */
FrontmatterService.INLINE_TAG_REGEX = /#[\w/-]+/g;
/** Matches tags array format: tags: [a, b] */
FrontmatterService.TAGS_ARRAY_REGEX = /^tags:\s*\[([^\]]+)\]/m;
/** Matches tags list format */
FrontmatterService.TAGS_LIST_REGEX = /^tags:\s*\n(\s+-\s+\S+\s*)+/m;
/** Matches source_link field */
FrontmatterService.SOURCE_LINK_REGEX = /source_link:\s*"\[\[(.+?)\]\]"/;
/** Matches flashcard_uid field */
FrontmatterService.UID_FIELD_REGEX = /flashcard_uid:\s*["']?([a-f0-9]+)["']?/i;
