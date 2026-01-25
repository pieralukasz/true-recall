/**
 * Missing Flashcards View
 * Panel-based view for displaying notes that need flashcards
 */
import { ItemView, WorkspaceLeaf, TFile, normalizePath } from "obsidian";
import {
	VIEW_TYPE_MISSING_FLASHCARDS,
} from "../../constants";
import { getEventBus } from "../../services";
import { createMissingFlashcardsStateManager } from "../../state/missing-flashcards.state";
import type { NoteWithMissingFlashcards } from "../../state/state.types";
import type { MissingFlashcardsSelectedEvent } from "../../types/events.types";
import { Panel } from "../components/Panel";
import { MissingFlashcardsContent } from "./MissingFlashcardsContent";
import type EpistemePlugin from "../../main";

// Target tags that require flashcards
const TARGET_TAGS = [
	{ tag: "mind/raw", type: "raw" as const, display: "Raw" },
	{ tag: "mind/zettel", type: "zettel" as const, display: "Zettel" },
];

/**
 * Missing Flashcards View
 * Panel-based version of MissingFlashcardsModal
 */
export class MissingFlashcardsView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createMissingFlashcardsStateManager();

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: MissingFlashcardsContent | null = null;

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

		// Create Panel component
		this.panelComponent = new Panel(container, {
			title: "Missing Flashcards",
			onRefresh: () => void this.loadMissingNotes(),
		});
		this.panelComponent.render();

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() => this.renderContent());

		// Initial render
		this.renderContent();

		// Start scanning
		void this.loadMissingNotes();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.panelComponent?.destroy();
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
	 * Render content (Panel is created once in onOpen)
	 */
	private renderContent(): void {
		if (!this.panelComponent) return;

		const state = this.stateManager.getState();
		const filteredNotes = this.stateManager.getFilteredNotes();

		const headerContainer = this.panelComponent.getHeaderContainer();
		const contentContainer = this.panelComponent.getContentContainer();

		// Clear and re-add summary section (header title row is preserved by Panel)
		const existingSummary = headerContainer.querySelector(".episteme-missing-summary");
		if (existingSummary) {
			existingSummary.remove();
		}

		// Add summary section after header
		const summaryEl = headerContainer.createDiv({
			cls: "episteme-missing-summary",
		});

		if (state.isLoading) {
			summaryEl.createDiv({
				text: "Scanning vault...",
				cls: "episteme-ready-label",
			});
		} else {
			summaryEl.createDiv({
				text: state.allMissingNotes.length.toString(),
				cls: "episteme-ready-count",
			});
			summaryEl.createDiv({
				text: state.allMissingNotes.length === 1 ? "note needs flashcards" : "notes need flashcards",
				cls: "episteme-ready-label",
			});
		}

		// Render Content
		this.contentComponent?.destroy();
		contentContainer.empty();
		this.contentComponent = new MissingFlashcardsContent(contentContainer, {
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
