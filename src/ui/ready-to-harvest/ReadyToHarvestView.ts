/**
 * Ready to Harvest View
 * Panel-based view for displaying notes that are ready to harvest
 * (all flashcards reviewed, no State.New cards)
 */
import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import { State } from "ts-fsrs";
import {
	VIEW_TYPE_READY_TO_HARVEST,
} from "../../constants";
import { createReadyToHarvestStateManager } from "../../state/ready-to-harvest.state";
import type { NoteReadyToHarvest } from "../../state/state.types";
import { Panel } from "../components/Panel";
import { ReadyToHarvestContent } from "./ReadyToHarvestContent";
import type EpistemePlugin from "../../main";

/**
 * Ready to Harvest View
 * Panel-based version of ReadyToHarvestModal
 */
export class ReadyToHarvestView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createReadyToHarvestStateManager();

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: ReadyToHarvestContent | null = null;

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

		// Create Panel component (shared with Projects)
		this.panelComponent = new Panel(container, {
			title: "Ready to Harvest",
			onRefresh: () => this.loadReadyNotes(),
		});
		this.panelComponent.render();

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.renderContent());

		// Initial render
		this.renderContent();

		// Start scanning
		void this.loadReadyNotes();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.panelComponent?.destroy();
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
	 * Render content (Panel is created once in onOpen)
	 */
	private renderContent(): void {
		if (!this.panelComponent) return;

		const state = this.stateManager.getState();
		const filteredNotes = this.stateManager.getFilteredNotes();

		const headerContainer = this.panelComponent.getHeaderContainer();
		const contentContainer = this.panelComponent.getContentContainer();

		// Clear and re-add summary section (header title row is preserved by Panel)
		const existingSummary = headerContainer.querySelector(".summary-section");
		if (existingSummary) {
			existingSummary.remove();
		}

		// Add summary section after header
		const summaryEl = headerContainer.createDiv({
			cls: "summary-section ep:text-center ep:p-4 ep:bg-obs-secondary ep:rounded-lg ep:mb-4",
		});
		if (state.isLoading) {
			summaryEl.createDiv({
				text: "Scanning vault...",
				cls: "ep:text-[13px] ep:text-obs-muted ep:mt-1",
			});
		} else {
			summaryEl.createDiv({
				text: state.allReadyNotes.length.toString(),
				cls: "ep:text-3xl ep:font-bold ep:text-green-500",
			});
			summaryEl.createDiv({
				text: state.allReadyNotes.length === 1 ? "note ready to harvest" : "notes ready to harvest",
				cls: "ep:text-[13px] ep:text-obs-muted ep:mt-1",
			});
		}

		// Render Content
		this.contentComponent?.destroy();
		contentContainer.empty();
		this.contentComponent = new ReadyToHarvestContent(contentContainer, {
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
