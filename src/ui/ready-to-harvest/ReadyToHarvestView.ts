/**
 * Ready to Harvest View
 * Panel-based view for displaying notes that are ready to harvest
 * (all flashcards reviewed, no State.New cards)
 */
import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import { State } from "ts-fsrs";
import {
	VIEW_TYPE_READY_TO_HARVEST,
	FLASHCARD_CONFIG,
} from "../../constants";
import { createReadyToHarvestStateManager } from "../../state/ready-to-harvest.state";
import type { NoteReadyToHarvest } from "../../state/state.types";
import { ReadyToHarvestHeader } from "./ReadyToHarvestHeader";
import { ReadyToHarvestContent } from "./ReadyToHarvestContent";
import type EpistemePlugin from "../../main";

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
 * Ready to Harvest View
 * Panel-based version of ReadyToHarvestModal
 */
export class ReadyToHarvestView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createReadyToHarvestStateManager();

	// UI Components
	private headerComponent: ReadyToHarvestHeader | null = null;
	private contentComponent: ReadyToHarvestContent | null = null;

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
		return VIEW_TYPE_READY_TO_HARVEST;
	}

	getDisplayText(): string {
		return "Ready to harvest";
	}

	getIcon(): string {
		return "sprout";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("episteme-ready-harvest-view");

		// Create container elements
		this.headerContainer = container.createDiv({
			cls: "episteme-ready-harvest-header-container",
		});
		this.contentContainer = container.createDiv({
			cls: "episteme-ready-harvest-content-container",
		});

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.render());

		// Initial render
		this.render();

		// Start scanning
		void this.loadReadyNotes();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.headerComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Load ready notes from vault
	 */
	private async loadReadyNotes(): Promise<void> {
		this.stateManager.setLoading(true);

		const readyNotes = await this.scanForReadyToHarvestNotes();
		this.stateManager.setReadyNotes(readyNotes);

		// Focus search after loading
		this.contentComponent?.focusSearch();
	}

	/**
	 * Scan vault for notes with #mind/raw tag where all cards are reviewed
	 */
	private async scanForReadyToHarvestNotes(): Promise<NoteReadyToHarvest[]> {
		const ready: NoteReadyToHarvest[] = [];
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

		const frontmatterService = this.plugin.flashcardManager.getFrontmatterService();

		for (const file of sourceFiles) {
			// Check if file has #mind/raw tag
			if (!this.hasMindRawTag(file)) continue;

			// Get source UID
			const sourceUid = await frontmatterService.getSourceNoteUid(file);
			if (!sourceUid) continue;

			// Get all flashcards for this note
			const cards = this.plugin.flashcardManager.getFlashcardsBySourceUid(sourceUid);

			// Check if cards exist AND if ALL cards are reviewed (NOT State.New)
			if (cards.length > 0 && this.areAllCardsReviewed(cards)) {
				ready.push({
					file,
					cardCount: cards.length,
				});
			}
		}

		// Sort by file name
		return ready.sort((a, b) =>
			a.file.basename.localeCompare(b.file.basename)
		);
	}

	/**
	 * Check if a file has the #mind/raw tag
	 */
	private hasMindRawTag(file: TFile): boolean {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return false;

		const frontmatterTags: unknown = cache.frontmatter?.tags ?? [];
		const normalizedFm = Array.isArray(frontmatterTags)
			? frontmatterTags
			: [frontmatterTags];

		const hasRawTag = normalizedFm.some(
			(t: string) => t === "mind/raw" || t === "#mind/raw"
		);

		if (hasRawTag) return true;

		// Check inline tags
		const inlineTags = cache.tags ?? [];
		return inlineTags.some((t) => t.tag === "#mind/raw");
	}

	/**
	 * Check if all cards are reviewed (no State.New cards)
	 */
	private areAllCardsReviewed(
		cards: ReturnType<typeof this.plugin.flashcardManager.getFlashcardsBySourceUid>
	): boolean {
		return !cards.some((card) => card.fsrs.state === State.New);
	}

	/**
	 * Handle note selection - open note in workspace
	 */
	private handleNoteSelect(file: TFile): void {
		void this.app.workspace.openLinkText(file.basename, file.path);
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
		this.headerComponent = new ReadyToHarvestHeader(this.headerContainer, {
			count: state.allReadyNotes.length,
			isLoading: state.isLoading,
			onRefresh: () => this.loadReadyNotes(),
		});
		this.headerComponent.render();

		// Render Content
		this.contentComponent?.destroy();
		this.contentContainer.empty();
		this.contentComponent = new ReadyToHarvestContent(this.contentContainer, {
			isLoading: state.isLoading,
			filteredNotes,
			totalCount: state.allReadyNotes.length,
			searchQuery: state.searchQuery,
			onSearchChange: (query) => this.stateManager.setSearchQuery(query),
			onNoteSelect: (file) => this.handleNoteSelect(file),
		});
		this.contentComponent.render();
	}
}
