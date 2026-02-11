import type { App } from "obsidian";
import { normalizePath } from "obsidian";

// Matches ![[filename]], ![[filename|size]], and ![[path/to/filename]]
const WIKILINK_EMBED_REGEX = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

export class AnkiMediaService {
	constructor(private app: App) {}

	async importMedia(
		media: Map<string, ArrayBuffer>,
		mediaMap: Record<string, string>,
		targetFolder: string
	): Promise<Map<string, string>> {
		const folderPath = normalizePath(targetFolder);
		await this.ensureFolder(folderPath);

		const pathMapping = new Map<string, string>();

		for (const [numericKey, originalName] of Object.entries(mediaMap)) {
			if (!originalName) continue;

			const fileData = media.get(numericKey) ?? media.get(originalName);
			if (!fileData) continue;

			const targetPath = normalizePath(`${targetFolder}/${originalName}`);

			try {
				if (!(await this.app.vault.adapter.exists(targetPath))) {
					await this.app.vault.adapter.writeBinary(targetPath, fileData);
				}
				pathMapping.set(originalName, targetPath);
			} catch (err) {
				console.error(
					`[True Recall] Failed to import media file "${originalName}":`,
					err
				);
			}
		}

		return pathMapping;
	}

	updateImportedContent(
		content: string,
		pathMapping: Map<string, string>
	): string {
		let result = content;
		for (const [originalName, vaultPath] of pathMapping) {
			// Only update if the vault path differs from the bare filename
			// (i.e., media is stored in a subfolder)
			if (originalName === vaultPath) continue;
			result = result
				.split(`![[${originalName}]]`)
				.join(`![[${vaultPath}]]`);
		}
		return result;
	}

	async collectExportMedia(
		cards: { question: string; answer: string }[]
	): Promise<{
		mediaFiles: Map<string, ArrayBuffer>;
		mediaMap: Record<string, string>;
	}> {
		const seenRefs = new Set<string>();

		for (const card of cards) {
			for (const ref of this.extractMediaRefs(card.question)) {
				seenRefs.add(ref);
			}
			for (const ref of this.extractMediaRefs(card.answer)) {
				seenRefs.add(ref);
			}
		}

		const mediaFiles = new Map<string, ArrayBuffer>();
		const mediaMap: Record<string, string> = {};
		let index = 0;

		for (const ref of seenRefs) {
			const data = await this.readVaultFile(ref);
			if (!data) continue;

			const filename = this.basenameOf(ref);
			const numericKey = String(index);
			mediaFiles.set(numericKey, data);
			mediaMap[numericKey] = filename;
			index++;
		}

		return { mediaFiles, mediaMap };
	}

	// Convert Obsidian ![[path/to/file.png]] embeds back to Anki <img src="file.png">
	convertContentForExport(content: string): string {
		return content.replace(WIKILINK_EMBED_REGEX, (_match, ref: string) => {
			const filename = this.basenameOf(ref);
			const ext = filename.split(".").pop()?.toLowerCase() ?? "";

			if (AUDIO_EXTENSIONS.has(ext)) {
				return `[sound:${filename}]`;
			}
			return `<img src="${filename}">`;
		});
	}

	private extractMediaRefs(content: string): string[] {
		const refs: string[] = [];
		let match: RegExpExecArray | null;

		// Reset lastIndex since the regex is global
		const regex = new RegExp(WIKILINK_EMBED_REGEX.source, "g");
		while ((match = regex.exec(content)) !== null) {
			const ref = match[1]?.trim();
			if (ref && this.isMediaFile(ref)) {
				refs.push(ref);
			}
		}
		return refs;
	}

	private async readVaultFile(ref: string): Promise<ArrayBuffer | null> {
		// Try the ref as-is (could be a full vault path)
		const normalizedRef = normalizePath(ref);
		try {
			if (await this.app.vault.adapter.exists(normalizedRef)) {
				return await this.app.vault.adapter.readBinary(normalizedRef);
			}
		} catch {
			// Fall through to filename-based search
		}

		// Try finding by filename across the vault
		const filename = this.basenameOf(ref);
		const allFiles = this.app.vault.getFiles();
		const found = allFiles.find((f) => f.name === filename);
		if (!found) return null;

		try {
			return await this.app.vault.adapter.readBinary(found.path);
		} catch {
			console.error(
				`[True Recall] Failed to read media file "${found.path}" for export`
			);
			return null;
		}
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		if (await this.app.vault.adapter.exists(folderPath)) return;

		// Create parent folders recursively
		const parts = folderPath.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!(await this.app.vault.adapter.exists(current))) {
				await this.app.vault.adapter.mkdir(current);
			}
		}
	}

	private basenameOf(path: string): string {
		const parts = path.split("/");
		return parts[parts.length - 1] ?? path;
	}

	private isMediaFile(ref: string): boolean {
		const ext = ref.split(".").pop()?.toLowerCase() ?? "";
		return IMAGE_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext);
	}
}

const IMAGE_EXTENSIONS = new Set([
	"png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "tif", "tiff",
]);

const AUDIO_EXTENSIONS = new Set([
	"mp3", "ogg", "wav", "m4a", "flac", "aac", "wma", "opus",
]);
