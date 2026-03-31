/**
 * Resolves source note info using IFileSystem and IMetadataIndex for O(1) lookups.
 * Platform-agnostic replacement for Obsidian vault/metadataCache usage.
 */

import type { IFileSystem } from "@true-recall/core/interfaces/file-system";
import type { IFrontmatter } from "@true-recall/core/interfaces/frontmatter";
import type { IMetadataIndex } from "@true-recall/core/interfaces/metadata-index";
import { FrontmatterService } from "./frontmatter.service";

export class SourceNoteService {
	private frontmatterService: FrontmatterService;
	private metadataIndex: IMetadataIndex | null;
	private frontmatterIndex: {
		getFileByValue(field: string, value: string): string | null;
	} | null = null;

	// Fallback cache for when IMetadataIndex is not available
	// Built lazily on first access, invalidated on vault changes
	private fallbackUidCache: Map<string, string> | null = null;
	private fallbackCacheBuilt = false;

	constructor(
		fileSystem: IFileSystem,
		frontmatter: IFrontmatter,
		metadataIndex?: IMetadataIndex,
	) {
		this.frontmatterService = new FrontmatterService(fileSystem, frontmatter);
		this.metadataIndex = metadataIndex ?? null;
	}

	setFrontmatterIndex(index: {
		getFileByValue(field: string, value: string): string | null;
	}): void {
		this.frontmatterIndex = index;
	}

	async getOrCreateSourceUid(filePath: string): Promise<string> {
		let uid = await this.frontmatterService.getSourceNoteUid(filePath);

		if (!uid) {
			uid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(filePath, uid);
		}

		return uid;
	}

	async getSourceUid(filePath: string): Promise<string | null> {
		return this.frontmatterService.getSourceNoteUid(filePath);
	}

	async setSourceUid(filePath: string, uid: string): Promise<void> {
		await this.frontmatterService.setSourceNoteUid(filePath, uid);
	}

	resolveSourceNote(sourceUid: string | undefined): {
		noteName?: string;
		notePath?: string;
	} {
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

	getSourceNotePath(notePath: string): string | null {
		// In the platform-agnostic version, we just validate the path exists
		// by checking if the metadata index has it
		if (this.metadataIndex) {
			const uid = this.metadataIndex.getFieldValue(notePath, "flashcard_uid");
			return uid !== undefined ? notePath : null;
		}
		return notePath;
	}

	findSourceNoteByUid(uid: string): string | null {
		return this.findPathByUidSync(uid);
	}

	private findPathByUidSync(uid: string): string | null {
		// O(1) lookup via FrontmatterIndexService (fastest — indexed Map)
		if (this.frontmatterIndex) {
			return this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
		}

		// Fallback: O(n) scan via IMetadataIndex
		if (this.metadataIndex) {
			return this.metadataIndex.getPathByFieldValue("flashcard_uid", uid);
		}

		// Fallback: Use cached Map (built once, O(1) lookups after)
		if (!this.fallbackCacheBuilt) {
			this.buildFallbackCache();
		}

		return this.fallbackUidCache?.get(uid) ?? null;
	}

	private buildFallbackCache(): void {
		console.error(
			"[SourceNoteService] MetadataIndex not available, building fallback cache",
		);
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

	invalidateFallbackCache(): void {
		this.fallbackUidCache = null;
		this.fallbackCacheBuilt = false;
	}

	async hasFlashcards(filePath: string): Promise<boolean> {
		const uid = await this.getSourceUid(filePath);
		return uid !== null;
	}

	enrichCard<T extends { sourceUid?: string }>(
		card: T,
	): T & {
		sourceNoteName: string;
		sourceNotePath: string;
	} {
		if (!card.sourceUid) {
			return { ...card, sourceNoteName: "", sourceNotePath: "" };
		}

		const path = this.findPathByUidSync(card.sourceUid);
		if (!path) {
			return { ...card, sourceNoteName: "", sourceNotePath: "" };
		}

		const lastSlash = path.lastIndexOf("/");
		const filename = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
		const basename = filename.replace(/\.md$/, "");

		return {
			...card,
			sourceNoteName: basename,
			sourceNotePath: path,
		};
	}

	enrichCards<T extends { sourceUid?: string }>(
		cards: T[],
	): Array<
		T & {
			sourceNoteName: string;
			sourceNotePath: string;
		}
	> {
		return cards.map((card) => this.enrichCard(card));
	}

	/**
	 * In-place enrichment for scheduling metadata.
	 * Mutates the objects directly to avoid spread-copy overhead on large arrays.
	 */
	enrichMeta<
		T extends {
			sourceUid?: string;
			sourceNoteName?: string;
			sourceNotePath?: string;
		},
	>(meta: T): T {
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

	enrichMetas<
		T extends {
			sourceUid?: string;
			sourceNoteName?: string;
			sourceNotePath?: string;
		},
	>(metas: T[]): T[] {
		for (const meta of metas) {
			this.enrichMeta(meta);
		}
		return metas;
	}
}
