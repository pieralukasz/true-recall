import { __awaiter } from "tslib";
import { isImageExtension, isVideoExtension, MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES, } from "@true-recall/core/types";
import { normalizePath, TFile } from "obsidian";
export class ImageService {
    constructor(app) {
        this.app = app;
    }
    saveImageFromClipboard(blob) {
        return __awaiter(this, void 0, void 0, function* () {
            const attachmentFolder = this.getAttachmentFolder();
            // Ensure attachment folder exists
            yield this.ensureFolderExists(attachmentFolder);
            // Generate unique filename
            const ext = this.getExtensionFromMimeType(blob.type);
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const filename = `pasted-image-${timestamp}-${randomSuffix}.${ext}`;
            const path = normalizePath(`${attachmentFolder}/${filename}`);
            // Convert blob to array buffer and save
            const arrayBuffer = yield blob.arrayBuffer();
            yield this.app.vault.createBinary(path, arrayBuffer);
            return path;
        });
    }
    getAttachmentFolder() {
        const attachmentFolderPath = this.app.vault.getConfig("attachmentFolderPath");
        if (!attachmentFolderPath || attachmentFolderPath === "/") {
            // Default to root if not configured
            return "";
        }
        // Handle relative paths (starting with ./)
        if (attachmentFolderPath.startsWith("./")) {
            // This means "same folder as current file" - use root for clipboard paste
            return "";
        }
        return attachmentFolderPath;
    }
    /**
     * Build Obsidian image markdown with optional width
     * Format: ![[image.png|300]] or ![[image.png]]
     */
    buildImageMarkdown(path, width) {
        const filename = this.getFilenameFromPath(path);
        if (width && width > 0) {
            return `![[${filename}|${width}]]`;
        }
        return `![[${filename}]]`;
    }
    extractImageRefs(content) {
        var _a, _b, _c, _d, _e, _f;
        const refs = [];
        // Match ![[image.png]], ![[image.png|300]], ![[path/to/image.png]]
        const wikiLinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
        for (let match = wikiLinkRegex.exec(content); match !== null; match = wikiLinkRegex.exec(content)) {
            const ref = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
            const ext = (_c = (_b = ref === null || ref === void 0 ? void 0 : ref.split(".").pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase()) !== null && _c !== void 0 ? _c : "";
            if (ref && isImageExtension(ext)) {
                refs.push(ref);
            }
        }
        // Also match standard markdown images ![alt](path)
        const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        for (let match = mdImageRegex.exec(content); match !== null; match = mdImageRegex.exec(content)) {
            const ref = (_d = match[1]) === null || _d === void 0 ? void 0 : _d.trim();
            const ext = (_f = (_e = ref === null || ref === void 0 ? void 0 : ref.split(".").pop()) === null || _e === void 0 ? void 0 : _e.toLowerCase()) !== null && _f !== void 0 ? _f : "";
            if (ref && isImageExtension(ext)) {
                refs.push(ref);
            }
        }
        return [...new Set(refs)]; // Remove duplicates
    }
    getRecentImages(limit = 20) {
        const imageFiles = this.app.vault
            .getFiles()
            .filter((file) => isImageExtension(file.extension))
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit);
        return imageFiles;
    }
    getImagesInFolder(folderPath) {
        return this.app.vault
            .getFiles()
            .filter((file) => isImageExtension(file.extension) && file.path.startsWith(folderPath))
            .sort((a, b) => a.basename.localeCompare(b.basename));
    }
    getRecentVideos(limit = 20) {
        const videoFiles = this.app.vault
            .getFiles()
            .filter((file) => isVideoExtension(file.extension))
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit);
        return videoFiles;
    }
    getRecentMedia(limit = 20) {
        return this.app.vault
            .getFiles()
            .filter((file) => isImageExtension(file.extension) || isVideoExtension(file.extension))
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit);
    }
    buildVideoHtml(file, width) {
        const resourcePath = this.app.vault.getResourcePath(file);
        const widthAttr = width ? ` width="${width}"` : "";
        return `<video src="${resourcePath}"${widthAttr} controls></video>`;
    }
    /**
     * Check if a video file is too large (>50MB)
     */
    isVideoTooLarge(file) {
        return file.stat.size > MAX_VIDEO_SIZE_BYTES;
    }
    isFileTooLarge(file) {
        return file.stat.size > MAX_IMAGE_SIZE_BYTES;
    }
    isBlobTooLarge(blob) {
        return blob.size > MAX_IMAGE_SIZE_BYTES;
    }
    formatFileSize(bytes) {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    replaceImagePath(content, oldPath, newPath) {
        const oldFilename = this.getFilenameFromPath(oldPath);
        const newFilename = this.getFilenameFromPath(newPath);
        // Replace in wiki-style links
        // Match ![[oldFilename]] or ![[oldFilename|size]]
        const wikiRegex = new RegExp(`!\\[\\[${this.escapeRegex(oldFilename)}(\\|[^\\]]+)?\\]\\]`, "g");
        content = content.replace(wikiRegex, (_match, sizeGroup) => {
            return `![[${newFilename}${sizeGroup !== null && sizeGroup !== void 0 ? sizeGroup : ""}]]`;
        });
        // Replace full path references
        const fullPathRegex = new RegExp(`!\\[\\[${this.escapeRegex(oldPath)}(\\|[^\\]]+)?\\]\\]`, "g");
        content = content.replace(fullPathRegex, (_match, sizeGroup) => {
            return `![[${newFilename}${sizeGroup !== null && sizeGroup !== void 0 ? sizeGroup : ""}]]`;
        });
        return content;
    }
    getImageFile(path) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile && isImageExtension(file.extension)) {
            return file;
        }
        return null;
    }
    resolveImagePath(ref) {
        var _a, _b;
        // Try direct path first
        const directFile = this.app.vault.getAbstractFileByPath(ref);
        if (directFile instanceof TFile) {
            return directFile.path;
        }
        // Try to find by filename
        const files = this.app.vault
            .getFiles()
            .filter((file) => isImageExtension(file.extension) &&
            (file.basename === ref || file.name === ref));
        if (files.length > 0) {
            return (_b = (_a = files[0]) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : null;
        }
        return null;
    }
    ensureFolderExists(folderPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!folderPath)
                return;
            const exists = yield this.app.vault.adapter.exists(folderPath);
            if (!exists) {
                yield this.app.vault.createFolder(folderPath);
            }
        });
    }
    getExtensionFromMimeType(mimeType) {
        var _a;
        const mimeMap = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/gif": "gif",
            "image/webp": "webp",
            "image/svg+xml": "svg",
        };
        return (_a = mimeMap[mimeType]) !== null && _a !== void 0 ? _a : "png";
    }
    getFilenameFromPath(path) {
        var _a;
        const parts = path.split("/");
        return (_a = parts[parts.length - 1]) !== null && _a !== void 0 ? _a : path;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
