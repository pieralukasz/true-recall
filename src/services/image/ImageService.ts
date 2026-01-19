/**
 * Image Service
 * Handles image operations for flashcards including clipboard paste,
 * vault operations, and markdown generation
 */
import { App, TFile, normalizePath } from "obsidian";
import {
    MAX_IMAGE_SIZE_BYTES,
    MAX_VIDEO_SIZE_BYTES,
    isImageExtension,
    isVideoExtension,
} from "../../types";

/**
 * Service for handling images in flashcards
 */
export class ImageService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Save image from clipboard blob to attachments folder
     * Returns the path to the saved image
     */
    async saveImageFromClipboard(blob: Blob): Promise<string> {
        const attachmentFolder = this.getAttachmentFolder();

        // Ensure attachment folder exists
        await this.ensureFolderExists(attachmentFolder);

        // Generate unique filename
        const ext = this.getExtensionFromMimeType(blob.type);
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const filename = `pasted-image-${timestamp}-${randomSuffix}.${ext}`;
        const path = normalizePath(`${attachmentFolder}/${filename}`);

        // Convert blob to array buffer and save
        const arrayBuffer = await blob.arrayBuffer();
        await this.app.vault.createBinary(path, arrayBuffer);

        return path;
    }

    /**
     * Get the attachment folder from Obsidian settings
     */
    getAttachmentFolder(): string {
        // @ts-expect-error - Accessing internal Obsidian API for attachment folder
        const attachmentFolderPath = this.app.vault.getConfig("attachmentFolderPath") as string;

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
    buildImageMarkdown(path: string, width?: number): string {
        const filename = this.getFilenameFromPath(path);

        if (width && width > 0) {
            return `![[${filename}|${width}]]`;
        }

        return `![[${filename}]]`;
    }

    /**
     * Extract image references from markdown content
     * Returns array of image paths found in the content
     */
    extractImageRefs(content: string): string[] {
        const refs: string[] = [];

        // Match ![[image.png]], ![[image.png|300]], ![[path/to/image.png]]
        const wikiLinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
        let match;

        while ((match = wikiLinkRegex.exec(content)) !== null) {
            const ref = match[1]!.trim();
            // Check if it's an image file
            const ext = ref.split(".").pop()?.toLowerCase() ?? "";
            if (isImageExtension(ext)) {
                refs.push(ref);
            }
        }

        // Also match standard markdown images ![alt](path)
        const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
        while ((match = mdImageRegex.exec(content)) !== null) {
            const ref = match[1]!.trim();
            const ext = ref.split(".").pop()?.toLowerCase() ?? "";
            if (isImageExtension(ext)) {
                refs.push(ref);
            }
        }

        return [...new Set(refs)]; // Remove duplicates
    }

    /**
     * Get recent images from the vault
     */
    getRecentImages(limit = 20): TFile[] {
        const imageFiles = this.app.vault.getFiles()
            .filter(file => isImageExtension(file.extension))
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit);

        return imageFiles;
    }

    /**
     * Get all images in a specific folder
     */
    getImagesInFolder(folderPath: string): TFile[] {
        return this.app.vault.getFiles()
            .filter(file =>
                isImageExtension(file.extension) &&
                file.path.startsWith(folderPath)
            )
            .sort((a, b) => a.basename.localeCompare(b.basename));
    }

    /**
     * Get recent videos from the vault
     */
    getRecentVideos(limit = 20): TFile[] {
        const videoFiles = this.app.vault.getFiles()
            .filter(file => isVideoExtension(file.extension))
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit);

        return videoFiles;
    }

    /**
     * Get recent media files (images + videos) from vault
     * Sorted by modification time
     */
    getRecentMedia(limit = 20): TFile[] {
        return this.app.vault.getFiles()
            .filter(file => isImageExtension(file.extension) || isVideoExtension(file.extension))
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, limit);
    }

    /**
     * Build HTML video tag with optional width
     * Uses Obsidian's getResourcePath for proper URL
     */
    buildVideoHtml(file: TFile, width?: number): string {
        const resourcePath = this.app.vault.getResourcePath(file);
        const widthAttr = width ? ` width="${width}"` : '';
        return `<video src="${resourcePath}"${widthAttr} controls></video>`;
    }

    /**
     * Check if a video file is too large (>50MB)
     */
    isVideoTooLarge(file: TFile): boolean {
        return file.stat.size > MAX_VIDEO_SIZE_BYTES;
    }

    /**
     * Check if a file is too large
     */
    isFileTooLarge(file: TFile): boolean {
        return file.stat.size > MAX_IMAGE_SIZE_BYTES;
    }

    /**
     * Check if a blob is too large
     */
    isBlobTooLarge(blob: Blob): boolean {
        return blob.size > MAX_IMAGE_SIZE_BYTES;
    }

    /**
     * Get file size in human readable format
     */
    formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Replace old image path with new path in content
     */
    replaceImagePath(content: string, oldPath: string, newPath: string): string {
        const oldFilename = this.getFilenameFromPath(oldPath);
        const newFilename = this.getFilenameFromPath(newPath);

        // Replace in wiki-style links
        // Match ![[oldFilename]] or ![[oldFilename|size]]
        const wikiRegex = new RegExp(
            `!\\[\\[${this.escapeRegex(oldFilename)}(\\|[^\\]]+)?\\]\\]`,
            "g"
        );
        content = content.replace(wikiRegex, (match, sizeGroup) => {
            return `![[${newFilename}${sizeGroup ?? ""}]]`;
        });

        // Replace full path references
        const fullPathRegex = new RegExp(
            `!\\[\\[${this.escapeRegex(oldPath)}(\\|[^\\]]+)?\\]\\]`,
            "g"
        );
        content = content.replace(fullPathRegex, (match, sizeGroup) => {
            return `![[${newFilename}${sizeGroup ?? ""}]]`;
        });

        return content;
    }

    /**
     * Get image file by path
     */
    getImageFile(path: string): TFile | null {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile && isImageExtension(file.extension)) {
            return file;
        }
        return null;
    }

    /**
     * Resolve image path to full vault path
     * Handles both full paths and filenames
     */
    resolveImagePath(ref: string): string | null {
        // Try direct path first
        const directFile = this.app.vault.getAbstractFileByPath(ref);
        if (directFile instanceof TFile) {
            return directFile.path;
        }

        // Try to find by filename
        const files = this.app.vault.getFiles()
            .filter(file =>
                isImageExtension(file.extension) &&
                (file.basename === ref || file.name === ref)
            );

        if (files.length > 0) {
            return files[0]!.path;
        }

        return null;
    }

    // ===== Private Helpers =====

    private async ensureFolderExists(folderPath: string): Promise<void> {
        if (!folderPath) return;

        const exists = await this.app.vault.adapter.exists(folderPath);
        if (!exists) {
            await this.app.vault.createFolder(folderPath);
        }
    }

    private getExtensionFromMimeType(mimeType: string): string {
        const mimeMap: Record<string, string> = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/gif": "gif",
            "image/webp": "webp",
            "image/svg+xml": "svg",
        };
        return mimeMap[mimeType] ?? "png";
    }

    private getFilenameFromPath(path: string): string {
        const parts = path.split("/");
        return parts[parts.length - 1] ?? path;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
