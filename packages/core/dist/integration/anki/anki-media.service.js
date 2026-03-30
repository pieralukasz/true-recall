import { __awaiter } from "tslib";
// Matches ![[filename]], ![[filename|size]], and ![[path/to/filename]]
const WIKILINK_EMBED_REGEX = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
export class AnkiMediaService {
    constructor(persistence, fileReader) {
        this.persistence = persistence;
        this.fileReader = fileReader;
    }
    importMedia(media, mediaMap, targetFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield this.ensureFolder(targetFolder);
            const pathMapping = new Map();
            for (const [numericKey, originalName] of Object.entries(mediaMap)) {
                if (!originalName)
                    continue;
                const fileData = (_a = media.get(numericKey)) !== null && _a !== void 0 ? _a : media.get(originalName);
                if (!fileData)
                    continue;
                const targetPath = `${targetFolder}/${originalName}`;
                try {
                    if (!(yield this.persistence.exists(targetPath))) {
                        yield this.persistence.writeBinary(targetPath, fileData);
                    }
                    pathMapping.set(originalName, targetPath);
                }
                catch (err) {
                    console.error(`[True Recall] Failed to import media file "${originalName}":`, err);
                }
            }
            return pathMapping;
        });
    }
    updateImportedContent(content, pathMapping) {
        let result = content;
        for (const [originalName, vaultPath] of pathMapping) {
            // Only update if the vault path differs from the bare filename
            // (i.e., media is stored in a subfolder)
            if (originalName === vaultPath)
                continue;
            result = result.split(`![[${originalName}]]`).join(`![[${vaultPath}]]`);
        }
        return result;
    }
    collectExportMedia(cards) {
        return __awaiter(this, void 0, void 0, function* () {
            const seenRefs = new Set();
            for (const card of cards) {
                for (const ref of this.extractMediaRefs(card.question)) {
                    seenRefs.add(ref);
                }
                for (const ref of this.extractMediaRefs(card.answer)) {
                    seenRefs.add(ref);
                }
            }
            const mediaFiles = new Map();
            const mediaMap = {};
            let index = 0;
            for (const ref of seenRefs) {
                const data = yield this.readVaultFile(ref);
                if (!data)
                    continue;
                const filename = this.basenameOf(ref);
                const numericKey = String(index);
                mediaFiles.set(numericKey, data);
                mediaMap[numericKey] = filename;
                index++;
            }
            return { mediaFiles, mediaMap };
        });
    }
    // Convert Obsidian ![[path/to/file.png]] embeds back to Anki <img src="file.png">
    convertContentForExport(content) {
        return content.replace(WIKILINK_EMBED_REGEX, (_match, ref) => {
            var _a, _b;
            const filename = this.basenameOf(ref);
            const ext = (_b = (_a = filename.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
            if (AUDIO_EXTENSIONS.has(ext)) {
                return `[sound:${filename}]`;
            }
            return `<img src="${filename}">`;
        });
    }
    extractMediaRefs(content) {
        var _a;
        const refs = [];
        // Reset lastIndex since the regex is global
        const regex = new RegExp(WIKILINK_EMBED_REGEX.source, "g");
        for (let match = regex.exec(content); match !== null; match = regex.exec(content)) {
            const ref = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
            if (ref && this.isMediaFile(ref)) {
                refs.push(ref);
            }
        }
        return refs;
    }
    readVaultFile(ref) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.fileReader)
                return null;
            // Try the ref as-is (could be a full vault path)
            try {
                if (yield this.fileReader.exists(ref)) {
                    return yield this.fileReader.readBinary(ref);
                }
            }
            catch (_a) {
                // Fall through to filename-based search
            }
            // Try finding by filename across the vault
            const filename = this.basenameOf(ref);
            const foundPath = this.fileReader.findByName(filename);
            if (!foundPath)
                return null;
            try {
                return yield this.fileReader.readBinary(foundPath);
            }
            catch (_b) {
                console.error(`[True Recall] Failed to read media file "${foundPath}" for export`);
                return null;
            }
        });
    }
    ensureFolder(folderPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.persistence.exists(folderPath))
                return;
            const parts = folderPath.split("/");
            let current = "";
            for (const part of parts) {
                current = current ? `${current}/${part}` : part;
                if (!(yield this.persistence.exists(current))) {
                    yield this.persistence.mkdir(current);
                }
            }
        });
    }
    basenameOf(path) {
        var _a;
        const parts = path.split("/");
        return (_a = parts[parts.length - 1]) !== null && _a !== void 0 ? _a : path;
    }
    isMediaFile(ref) {
        var _a, _b;
        const ext = (_b = (_a = ref.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
        return IMAGE_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext);
    }
}
const IMAGE_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "bmp",
    "svg",
    "webp",
    "ico",
    "tif",
    "tiff",
]);
const AUDIO_EXTENSIONS = new Set([
    "mp3",
    "ogg",
    "wav",
    "m4a",
    "flac",
    "aac",
    "wma",
    "opus",
]);
