/**
 * Notes Without Projects View
 * Panel-based view for displaying notes that don't belong to any project
 */
import { ItemView, WorkspaceLeaf, TFile, normalizePath, Platform, Menu, Notice } from "obsidian";
import { VIEW_TYPE_NOTES_WITHOUT_PROJECTS } from "../../constants";
import { createNotesWithoutProjectsStateManager, type NoteWithoutProject } from "../../state/notes-without-projects.state";
import { Panel } from "../components/Panel";
import { NotesWithoutProjectsContent } from "./NotesWithoutProjectsContent";
import type EpistemePlugin from "../../main";

/**
 * Notes Without Projects View
 * Panel for managing notes that don't belong to any project
 */
export class NotesWithoutProjectsView extends ItemView {
	private plugin: EpistemePlugin;
	private stateManager = createNotesWithoutProjectsStateManager();

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: NotesWithoutProjectsContent | null = null;

	// Native header action elements
	private refreshAction: HTMLElement | null = null;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_NOTES_WITHOUT_PROJECTS;
	}

	getDisplayText(): string {
		return "Notes without projects";
	}

	getIcon(): string {
		return "file-question";
	}

	/**
	 * Add items to the native "..." menu (mobile)
	 */
	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);

		if (!Platform.isMobile) return;

		menu.addItem((item) => {
			item.setTitle("Refresh")
				.setIcon("refresh-cw")
				.onClick(() => void this.loadNotes());
		});
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		// Create Panel component (header is native Obsidian header)
		this.panelComponent = new Panel(container);
		this.panelComponent.render();

		// Add native refresh action (desktop only - on mobile it's in "..." menu)
		if (!Platform.isMobile) {
			this.refreshAction = this.addAction("refresh-cw", "Refresh", () => {
				void this.loadNotes();
			});
		}

		// Subscribe to state changes
		this.unsubscribe = this.stateManager.subscribe(() =>
			this.renderContent()
		);

		// Initial render
		this.renderContent();

		// Load notes
		void this.loadNotes();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();

		// Remove native header action
		if (this.refreshAction) {
			this.refreshAction.remove();
			this.refreshAction = null;
		}

		this.panelComponent?.destroy();
		this.contentComponent?.destroy();
	}

	/**
	 * Load notes without projects from vault
	 */
	private async loadNotes(): Promise<void> {
		this.stateManager.setLoading(true);

		const notes = await this.findNotesWithoutProjects();
		this.stateManager.setNotes(notes);
	}

	/**
	 * Find all notes that don't belong to any project
	 * Uses FrontmatterIndexService and excludes folders from settings
	 */
	private async findNotesWithoutProjects(): Promise<NoteWithoutProject[]> {
		const notes: NoteWithoutProject[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();
		const frontmatterIndex = this.plugin.frontmatterIndex;
		const excludedFolders = this.plugin.settings.excludedFolders;

		// Get all files that have projects assigned
		const filesWithProjects = new Set<string>();
		const allProjectNames = frontmatterIndex.getAllValues("projects");
		for (const projectName of allProjectNames) {
			const files = frontmatterIndex.getFilesByValue("projects", projectName);
			for (const file of files) {
				filesWithProjects.add(file.path);
			}
		}

		// Filter files
		for (const file of allFiles) {
			// Skip files that have projects
			if (filesWithProjects.has(file.path)) continue;

			// Skip .episteme/ folder
			if (file.path.startsWith(".episteme/")) continue;

			// Skip excluded folders
			let excluded = false;
			for (const excludedFolder of excludedFolders) {
				const normalizedExcluded = normalizePath(excludedFolder);
				if (
					file.path.startsWith(normalizedExcluded + "/") ||
					file.path === normalizedExcluded
				) {
					excluded = true;
					break;
				}
			}
			if (excluded) continue;

			notes.push({
				file,
				name: file.basename,
				path: file.path,
			});
		}

		// Sort alphabetically by name
		return notes.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Get available projects sorted alphabetically
	 */
	private getAvailableProjects(): string[] {
		const frontmatterIndex = this.plugin.frontmatterIndex;
		const allProjectNames = frontmatterIndex.getAllValues("projects");
		return Array.from(allProjectNames).sort((a, b) => a.localeCompare(b));
	}

	/**
	 * Handle moving selected notes to a project
	 */
	private async handleMoveToProject(projectName: string): Promise<void> {
		const state = this.stateManager.getState();
		const selectedPaths = Array.from(state.selectedNotePaths);

		if (selectedPaths.length === 0) {
			new Notice("No notes selected");
			return;
		}

		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();

		let successCount = 0;
		let errorCount = 0;

		for (const notePath of selectedPaths) {
			try {
				const file = this.app.vault.getAbstractFileByPath(notePath);
				if (!(file instanceof TFile)) {
					errorCount++;
					continue;
				}

				// Ensure note has a UID
				let sourceUid = await frontmatterService.getSourceNoteUid(file);
				if (!sourceUid) {
					sourceUid = frontmatterService.generateUid();
					await frontmatterService.setSourceNoteUid(file, sourceUid);
				}

				// Get current projects and add new one
				const content = await this.app.vault.cachedRead(file);
				const currentProjects =
					frontmatterService.extractProjectsFromFrontmatter(content);

				if (!currentProjects.includes(projectName)) {
					const newProjects = [...currentProjects, projectName];
					await frontmatterService.setProjectsInFrontmatter(file, newProjects);
				}

				successCount++;
			} catch (error) {
				console.error(
					`[NotesWithoutProjectsView] Error moving note ${notePath} to project:`,
					error
				);
				errorCount++;
			}
		}

		// Show result notice
		if (errorCount === 0) {
			new Notice(
				`Moved ${successCount} note${successCount !== 1 ? "s" : ""} to "${projectName}"`
			);
		} else {
			new Notice(
				`Moved ${successCount} note${successCount !== 1 ? "s" : ""}, ${errorCount} failed`
			);
		}

		// Reload notes to reflect changes
		await this.loadNotes();
	}

	/**
	 * Handle opening a note
	 */
	private handleOpenNote(notePath: string): void {
		void this.app.workspace.openLinkText(notePath, "", false);
	}

	/**
	 * Render content (Panel is created once in onOpen)
	 */
	private renderContent(): void {
		if (!this.panelComponent) return;

		const state = this.stateManager.getState();
		const filteredNotes = this.stateManager.getFilteredNotes();
		const availableProjects = this.getAvailableProjects();

		const contentContainer = this.panelComponent.getContentContainer();

		// Create component once, then just update props
		if (!this.contentComponent) {
			contentContainer.empty();
			this.contentComponent = new NotesWithoutProjectsContent(contentContainer, {
				isLoading: state.isLoading,
				notes: filteredNotes,
				searchQuery: state.searchQuery,
				selectedNotePaths: state.selectedNotePaths,
				availableProjects,
				onSearchChange: (query) => this.stateManager.setSearchQuery(query),
				onToggleSelect: (notePath) =>
					this.stateManager.toggleNoteSelection(notePath),
				onSelectAll: () => this.stateManager.selectAllFiltered(),
				onClearSelection: () => this.stateManager.clearSelection(),
				onMoveToProject: (projectName) =>
					void this.handleMoveToProject(projectName),
				onRefresh: () => void this.loadNotes(),
				onOpenNote: (notePath) => this.handleOpenNote(notePath),
			});
			this.contentComponent.render();
		} else {
			// Just update props - don't destroy/recreate
			this.contentComponent.updateProps({
				isLoading: state.isLoading,
				notes: filteredNotes,
				searchQuery: state.searchQuery,
				selectedNotePaths: state.selectedNotePaths,
				availableProjects,
			});
		}
	}
}
