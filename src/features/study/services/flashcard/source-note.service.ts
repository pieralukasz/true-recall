/**
 * Resolves source note info from vault using FrontmatterIndexService for O(1) lookups
 */
import { type App, TFile } from "obsidian";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import { FrontmatterService } from "@features/study/services/flashcard/frontmatter.service";

export class SourceNoteService {
	private app: App;
	private frontmatterService: FrontmatterService;
	private frontmatterIndex: FrontmatterIndexService | null;

	// Fallback cache for when FrontmatterIndex is not available
	// Built lazily on first access, invalidated on vault changes
	private fallbackUidCache: Map<string, TFile> | null = null;
	private fallbackCacheBuilt = false;

	constructor(app: App, frontmatterIndex?: FrontmatterIndexService) {
		this.app = app;
		this.frontmatterService = new FrontmatterService(app);
		this.frontmatterIndex = frontmatterIndex ?? null;
	}

	async getOrCreateSourceUid(file: TFile): Promise<string> {
		let uid = await this.frontmatterService.getSourceNoteUid(file);

		if (!uid) {
			uid = this.frontmatterService.generateUid();
			await this.frontmatterService.setSourceNoteUid(file, uid);
		}

		return uid;
	}

	async getSourceUid(file: TFile): Promise<string | null> {
		return this.frontmatterService.getSourceNoteUid(file);
	}

	async setSourceUid(file: TFile, uid: string): Promise<void> {
		await this.frontmatterService.setSourceNoteUid(file, uid);
	}

	resolveSourceNote(sourceUid: string | undefined): {
		noteName?: string;
		notePath?: string;
	} {
		if (!sourceUid) {
			return {};
		}

		// Find file by UID in vault
		const file = this.findFileByUidSync(sourceUid);
		if (!file) {
			return {};
		}

		return {
			noteName: file.basename,
			notePath: file.path,
		};
	}

	getSourceNoteFile(notePath: string): TFile | null {
		const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
		return abstractFile instanceof TFile ? abstractFile : null;
	}

	findSourceNoteByUid(uid: string): TFile | null {
		return this.findFileByUidSync(uid);
	}

	private findFileByUidSync(uid: string): TFile | null {
		// O(1) lookup via index (preferred)
		if (this.frontmatterIndex) {
			return this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
		}

		// Fallback: Use cached Map (built once, O(1) lookups after)
		if (!this.fallbackCacheBuilt) {
			this.buildFallbackCache();
		}

		return this.fallbackUidCache?.get(uid) ?? null;
	}

	private buildFallbackCache(): void {
		console.error(
			"[SourceNoteService] FrontmatterIndex not available, building fallback cache",
		);
		this.fallbackUidCache = new Map();

		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			const uid = cache?.frontmatter?.flashcard_uid as unknown;
			if (uid && typeof uid === "string") {
				this.fallbackUidCache.set(uid, file);
			}
		}

		this.fallbackCacheBuilt = true;
	}

	invalidateFallbackCache(): void {
		this.fallbackUidCache = null;
		this.fallbackCacheBuilt = false;
	}

	async hasFlashcards(file: TFile): Promise<boolean> {
		const uid = await this.getSourceUid(file);
		return uid !== null;
	}

	enrichCard<T extends { sourceUid?: string }>(
		card: T,
	): T & {
		sourceNoteName: string;
		sourceNotePath: string;
		projects: string[];
	} {
		if (!card.sourceUid) {
			return { ...card, sourceNoteName: "", sourceNotePath: "", projects: [] };
		}

		const file = this.findFileByUidSync(card.sourceUid);
		if (!file) {
			return { ...card, sourceNoteName: "", sourceNotePath: "", projects: [] };
		}

		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const rawProjects = frontmatter?.projects as unknown;
		const projects: string[] = Array.isArray(rawProjects)
			? rawProjects.filter((p): p is string => typeof p === "string")
			: [];

		return {
			...card,
			sourceNoteName: file.basename,
			sourceNotePath: file.path,
			projects,
		};
	}

	enrichCards<T extends { sourceUid?: string }>(
		cards: T[],
	): Array<
		T & {
			sourceNoteName: string;
			sourceNotePath: string;
			projects: string[];
		}
	> {
		return cards.map((card) => this.enrichCard(card));
	}
}
