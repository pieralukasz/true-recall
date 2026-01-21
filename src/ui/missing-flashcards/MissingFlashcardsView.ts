/**
 * Missing Flashcards View
 * Panel-based view for displaying notes that need flashcards
 */
import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import {
	VIEW_TYPE_MISSING_FLASHCARDS,
	FLASHCARD_CONFIG,
} from "../../constants";
import { getEventBus } from "../../services";
import { createMissingFlashcardsStateManager } from "../../state/missing-flashcards.state";
import type { NoteWithMissingFlashcards } from "../../state/state.types";
import type { MissingFlashcardsSelectedEvent } from "../../types/events.types";
import { MissingFlashcardsHeader } from "./MissingFlashcardsHeader";
import { MissingFlashcardsContent } from "./MissingFlashcardsContent";
import type EpistemePlugin from "../../main";

// Target tags that require flashcards
const TARGET_TAGS = [
	{ tag: "mind/raw", type: "raw" as const, display: "Raw" },
	{ tag: "mind/zettel", type: "zettel" as const, display: "Zettel" },
];

/**
 * Check if a file is a flashcard file based on naming pattern
 */
function isFlashcardFileByName(fileName: string): boolean {
	if (fileName.startsWith(FLASHCARD_CONFIG.filePrefix)) {
		return true;
	}
	const uidPattern = new RegExp(
		`^[a-f0-9]{${FLASHCARD_CONFIG.uidLength}}\\.md$`,
		"i"
	);
	return uidPattern.test(fileName);
}

/**
 * Missing Flashcards View
 * Panel-based version of MissingFlashcardsModal
 */
export class MissingFlashcardsView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createMissingFlashcardsStateManager();

	// UI Components
	private headerComponent: MissingFlashcardsHeader | null = null;
	private contentComponent: MissingFlashcardsContent | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MISSING_FLASHCARDS;
	}

	getDisplayText(): string {
		return "Missing flashcards";
	}

	getIcon(): string {
		return "search";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("episteme-panel-view");

		// Create container elements
		this.headerContainer = container.createDiv({
			cls: "episteme-panel-header-container",
		});
		this.contentContainer = container.createDiv({
			cls: "episteme-panel-content-container",
		});

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.render());

		// Initial render
		this.render();

		// Start scanning
		void this.loadMissingNotes();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.headerComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Load missing notes from vault
	 */
	private async loadMissingNotes(): Promise<void> {
		this.stateManager.setLoading(true);

		const missingNotes = await this.scanForMissingFlashcards();
		this.stateManager.setMissingNotes(missingNotes);

		// Focus search after loading
		this.contentComponent?.focusSearch();
	}

	/**
	 * Scan vault for notes with target tags that lack flashcards
	 */
	private async scanForMissingFlashcards(): Promise<
		NoteWithMissingFlashcards[]
	> {
		const missing: NoteWithMissingFlashcards[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		const excludedFolders = this.plugin.settings.excludedFolders;

		// Filter out flashcard files and excluded folders
		const sourceFiles = allFiles.filter((file) => {
			// Exclude files in excluded folders
			for (const excludedFolder of excludedFolders) {
				const normalizedExcluded = normalizePath(excludedFolder);
				if (
					file.path.startsWith(normalizedExcluded + "/") ||
					file.path === normalizedExcluded
				) {
					return false;
				}
			}
			// Exclude flashcard files by name pattern
			if (isFlashcardFileByName(file.name)) {
				return false;
			}
			return true;
		});

		for (const file of sourceFiles) {
			const tagInfo = this.getTargetTagType(file);
			if (!tagInfo) continue;

			const flashcardInfo = await this.plugin.flashcardManager.getFlashcardInfo(
				file
			);
			if (!flashcardInfo.exists || flashcardInfo.cardCount === 0) {
				missing.push({
					file,
					tagType: tagInfo.type,
					tagDisplay: tagInfo.display,
				});
			}
		}

		// Sort by tag type, then by name
		const tagOrder = { raw: 0, zettel: 1 };
		return missing.sort((a, b) => {
			const orderDiff = tagOrder[a.tagType] - tagOrder[b.tagType];
			if (orderDiff !== 0) return orderDiff;
			return a.file.basename.localeCompare(b.file.basename);
		});
	}

	/**
	 * Check if a file has any of the target tags
	 */
	private getTargetTagType(
		file: TFile
	): { tag: string; type: "raw" | "zettel"; display: string } | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return null;

		const frontmatterTags: unknown = cache.frontmatter?.tags ?? [];
		const normalizedFm = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		for (const target of TARGET_TAGS) {
			if (
				normalizedFm.some(
					(t: string) => t === target.tag || t === `#${target.tag}`
				)
			) {
				return target;
			}
		}

		// Check inline tags
		const inlineTags = cache.tags ?? [];
		for (const target of TARGET_TAGS) {
			if (inlineTags.some((t) => t.tag === `#${target.tag}`)) {
				return target;
			}
		}

		return null;
	}

	/**
	 * Handle note selection
	 */
	private handleNoteSelect(notePath: string): void {
		this.emitResultAndClose({
			cancelled: false,
			selectedNotePath: notePath,
		});
	}

	/**
	 * Emit result event and close the view
	 */
	private emitResultAndClose(result: MissingFlashcardsSelectedEvent["result"]): void {
		const eventBus = getEventBus();

		const event: MissingFlashcardsSelectedEvent = {
			type: "missing-flashcards:selected",
			result,
			timestamp: Date.now(),
		};

		eventBus.emit(event);

		// Close the panel view
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MISSING_FLASHCARDS);
		for (const leaf of leaves) {
			leaf.detach();
		}
	}

	/**
	 * Render all components
	 */
	private render(): void {
		const state = this.stateManager.getState();
		const filteredNotes = this.stateManager.getFilteredNotes();

		// Render Header
		this.headerComponent?.destroy();
		this.headerContainer.empty();
		this.headerComponent = new MissingFlashcardsHeader(this.headerContainer, {
			count: state.allMissingNotes.length,
			isLoading: state.isLoading,
		});
		this.headerComponent.render();

		// Render Content
		this.contentComponent?.destroy();
		this.contentContainer.empty();
		this.contentComponent = new MissingFlashcardsContent(this.contentContainer, {
			isLoading: state.isLoading,
			filteredNotes,
			totalCount: state.allMissingNotes.length,
			searchQuery: state.searchQuery,
			activeTagFilter: state.activeTagFilter,
			onSearchChange: (query) => this.stateManager.setSearchQuery(query),
			onTagFilterChange: (filter) => this.stateManager.setTagFilter(filter),
			onNoteSelect: (notePath) => this.handleNoteSelect(notePath),
		});
		this.contentComponent.render();
	}
}
