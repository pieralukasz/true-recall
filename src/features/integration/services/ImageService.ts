import {
	isImageExtension,
	isVideoExtension,
	MAX_IMAGE_SIZE_BYTES,
	MAX_VIDEO_SIZE_BYTES,
} from "@shared/types";
import { type App, normalizePath, TFile } from "obsidian";

export class ImageService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

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

	getAttachmentFolder(): string {
		const attachmentFolderPath = (
			this.app.vault as unknown as { getConfig: (key: string) => string }
		).getConfig("attachmentFolderPath");

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

	extractImageRefs(content: string): string[] {
		const refs: string[] = [];

		// Match ![[image.png]], ![[image.png|300]], ![[path/to/image.png]]
		const wikiLinkRegex = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

		for (
			let match = wikiLinkRegex.exec(content);
			match !== null;
			match = wikiLinkRegex.exec(content)
		) {
			const ref = match[1]?.trim();
			// Check if it's an image file
			const ext = ref?.split(".").pop()?.toLowerCase() ?? "";
			if (ref && isImageExtension(ext)) {
				refs.push(ref);
			}
		}

		// Also match standard markdown images ![alt](path)
		const mdImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
		for (
			let match = mdImageRegex.exec(content);
			match !== null;
			match = mdImageRegex.exec(content)
		) {
			const ref = match[1]?.trim();
			const ext = ref?.split(".").pop()?.toLowerCase() ?? "";
			if (ref && isImageExtension(ext)) {
				refs.push(ref);
			}
		}

		return [...new Set(refs)]; // Remove duplicates
	}

	getRecentImages(limit = 20): TFile[] {
		const imageFiles = this.app.vault
			.getFiles()
			.filter((file) => isImageExtension(file.extension))
			.sort((a, b) => b.stat.mtime - a.stat.mtime)
			.slice(0, limit);

		return imageFiles;
	}

	getImagesInFolder(folderPath: string): TFile[] {
		return this.app.vault
			.getFiles()
			.filter(
				(file) =>
					isImageExtension(file.extension) && file.path.startsWith(folderPath),
			)
			.sort((a, b) => a.basename.localeCompare(b.basename));
	}

	getRecentVideos(limit = 20): TFile[] {
		const videoFiles = this.app.vault
			.getFiles()
			.filter((file) => isVideoExtension(file.extension))
			.sort((a, b) => b.stat.mtime - a.stat.mtime)
			.slice(0, limit);

		return videoFiles;
	}

	getRecentMedia(limit = 20): TFile[] {
		return this.app.vault
			.getFiles()
			.filter(
				(file) =>
					isImageExtension(file.extension) || isVideoExtension(file.extension),
			)
			.sort((a, b) => b.stat.mtime - a.stat.mtime)
			.slice(0, limit);
	}

	buildVideoHtml(file: TFile, width?: number): string {
		const resourcePath = this.app.vault.getResourcePath(file);
		const widthAttr = width ? ` width="${width}"` : "";
		return `<video src="${resourcePath}"${widthAttr} controls></video>`;
	}

	/**
	 * Check if a video file is too large (>50MB)
	 */
	isVideoTooLarge(file: TFile): boolean {
		return file.stat.size > MAX_VIDEO_SIZE_BYTES;
	}

	isFileTooLarge(file: TFile): boolean {
		return file.stat.size > MAX_IMAGE_SIZE_BYTES;
	}

	isBlobTooLarge(blob: Blob): boolean {
		return blob.size > MAX_IMAGE_SIZE_BYTES;
	}

	formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	replaceImagePath(content: string, oldPath: string, newPath: string): string {
		const oldFilename = this.getFilenameFromPath(oldPath);
		const newFilename = this.getFilenameFromPath(newPath);

		// Replace in wiki-style links
		// Match ![[oldFilename]] or ![[oldFilename|size]]
		const wikiRegex = new RegExp(
			`!\\[\\[${this.escapeRegex(oldFilename)}(\\|[^\\]]+)?\\]\\]`,
			"g",
		);
		content = content.replace(wikiRegex, (_match, sizeGroup) => {
			return `![[${newFilename}${sizeGroup ?? ""}]]`;
		});

		// Replace full path references
		const fullPathRegex = new RegExp(
			`!\\[\\[${this.escapeRegex(oldPath)}(\\|[^\\]]+)?\\]\\]`,
			"g",
		);
		content = content.replace(fullPathRegex, (_match, sizeGroup) => {
			return `![[${newFilename}${sizeGroup ?? ""}]]`;
		});

		return content;
	}

	getImageFile(path: string): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile && isImageExtension(file.extension)) {
			return file;
		}
		return null;
	}

	resolveImagePath(ref: string): string | null {
		// Try direct path first
		const directFile = this.app.vault.getAbstractFileByPath(ref);
		if (directFile instanceof TFile) {
			return directFile.path;
		}

		// Try to find by filename
		const files = this.app.vault
			.getFiles()
			.filter(
				(file) =>
					isImageExtension(file.extension) &&
					(file.basename === ref || file.name === ref),
			);

		if (files.length > 0) {
			return files[0]?.path ?? null;
		}

		return null;
	}

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
