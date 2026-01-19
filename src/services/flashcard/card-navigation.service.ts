/**
 * Card Navigation Service
 * Handles file opening and navigation for flashcards
 *
 * Extracted from FlashcardManager to separate navigation concerns.
 */
import { App, TFile, WorkspaceLeaf, Platform } from "obsidian";

/**
 * Options for opening a file
 */
export interface OpenFileOptions {
	/** Open in a new tab */
	newTab?: boolean;
	/** Open in split view */
	split?: "horizontal" | "vertical";
	/** Focus the new leaf after opening */
	focus?: boolean;
}

/**
 * Service for navigating to flashcards and source notes
 */
export class CardNavigationService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Open a source note file in the editor
	 *
	 * @param file - The file to open
	 * @param options - Opening options
	 */
	async openSourceNote(file: TFile, options: OpenFileOptions = {}): Promise<void> {
		const { newTab = true, focus = true } = options;

		// Get or create a leaf
		let leaf: WorkspaceLeaf;

		if (newTab) {
			leaf = this.app.workspace.getLeaf("tab");
		} else {
			leaf = this.app.workspace.getLeaf(false);
		}

		// Open the file
		await leaf.openFile(file, { active: focus });
	}

	/**
	 * Open a flashcard file in the editor
	 * Alias for openSourceNote for semantic clarity
	 *
	 * @param file - The file to open
	 * @param options - Opening options
	 */
	async openFlashcardFile(file: TFile, options: OpenFileOptions = {}): Promise<void> {
		await this.openSourceNote(file, options);
	}

	/**
	 * Navigate to a specific line in a file
	 *
	 * @param file - The file to open
	 * @param line - The line number to scroll to
	 * @param options - Opening options
	 */
	async navigateToLine(file: TFile, line: number, options: OpenFileOptions = {}): Promise<void> {
		const { newTab = true, focus = true } = options;

		let leaf: WorkspaceLeaf;

		if (newTab) {
			leaf = this.app.workspace.getLeaf("tab");
		} else {
			leaf = this.app.workspace.getLeaf(false);
		}

		await leaf.openFile(file, {
			active: focus,
			eState: { line },
		});
	}

	/**
	 * Open a file by path
	 *
	 * @param filePath - Path to the file
	 * @param options - Opening options
	 * @returns The file if found and opened, null otherwise
	 */
	async openByPath(filePath: string, options: OpenFileOptions = {}): Promise<TFile | null> {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			return null;
		}

		await this.openSourceNote(file, options);
		return file;
	}

	/**
	 * Focus an already open file if it exists
	 *
	 * @param filePath - Path to the file
	 * @returns True if the file was found and focused
	 */
	focusIfOpen(filePath: string): boolean {
		const leaves = this.app.workspace.getLeavesOfType("markdown");

		for (const leaf of leaves) {
			const view = leaf.view;
			if ("file" in view && view.file instanceof TFile && view.file.path === filePath) {
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if we're on mobile (affects navigation behavior)
	 */
	isMobile(): boolean {
		return Platform.isMobile;
	}

	/**
	 * Get the currently active file
	 */
	getActiveFile(): TFile | null {
		return this.app.workspace.getActiveFile();
	}
}
