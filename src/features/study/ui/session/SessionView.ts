import type { DayBoundaryService } from "@features/core/services/day-boundary.service";
import { SessionApp } from "@features/study/ui/session/SessionApp";
import { SessionLogic } from "@features/study/ui/session/SessionLogic";
import { VIEW_TYPE_SESSION } from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import type { SessionApi } from "@shared/store";
import type { FSRSFlashcardItem } from "@shared/types";
import type { SessionResult } from "@shared/types/events.types";
import { AddToProjectModal } from "@shared/ui/modals/AddToProjectModal";
import { MoveCardModal } from "@shared/ui/modals/MoveCardModal";
import { mountPreact } from "@shared/ui/preact";
import { SessionResultFactory } from "@shared/utils/session-result-factory";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../../../main";

export interface SessionViewOptions {
	currentNoteName: string | null;
	allCards: FSRSFlashcardItem[];
	dayBoundaryService: DayBoundaryService;
	onSessionSelected: (result: SessionResult) => void;
}

export class SessionView extends ItemView {
	private plugin: TrueRecallPlugin;
	private logic: SessionLogic | null = null;
	private unmountPreact?: () => void;

	// Header actions need to stay in the view (Obsidian API)
	private startSessionAction: HTMLElement | null = null;
	private clearSelectionAction: HTMLElement | null = null;
	private moveAction: HTMLElement | null = null;
	private addToProjectAction: HTMLElement | null = null;

	private onSessionSelected: ((result: SessionResult) => void) | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private get session(): SessionApi {
		const store = this.plugin.store;
		if (!store) throw new Error("Store not initialized");
		return store.getState().session;
	}

	getViewType(): string {
		return VIEW_TYPE_SESSION;
	}

	getDisplayText(): string {
		return "Session";
	}

	getIcon(): string {
		return "list-filter";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("ep:h-full", "ep:flex", "ep:flex-col");

		// Header actions are Obsidian-native, subscribe to store for them
		if (!this.plugin.store) return;
		this.unsubscribe = this.plugin.store.subscribe(
			(state) => state.session,
			() => {
				this.updateHeaderActions();
				this.updateTitle();
				// Re-mount Preact when logic exists (initialize may come later)
				this.mountApp(container);
			},
		);
	}

	private mountApp(container: HTMLElement): void {
		if (!this.logic) return;

		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(SessionApp, {
				logic: this.logic,
				onSelectAndClose: (result: SessionResult) =>
					this.selectAndClose(result),
			}),
		);
	}

	initialize(options: SessionViewOptions): void {
		this.onSessionSelected = options.onSessionSelected;
		this.logic = new SessionLogic(options.allCards, options.dayBoundaryService);
		this.session.initialize(options.currentNoteName, options.allCards);
		this.session.updateTimestamp();

		// Mount after logic is ready
		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
			this.mountApp(container);
		}
	}

	private updateHeaderActions(): void {
		const selectionCount = this.session.selectedNotes.size;

		// Remove existing actions
		this.clearSelectionAction?.remove();
		this.startSessionAction?.remove();
		this.moveAction?.remove();
		this.addToProjectAction?.remove();
		this.clearSelectionAction = null;
		this.startSessionAction = null;
		this.moveAction = null;
		this.addToProjectAction = null;

		if (selectionCount > 0) {
			this.startSessionAction = this.addAction("play", "Start session", () => {
				const selectedNotes = this.session.selectedNotes;
				if (selectedNotes.size === 0) return;
				const result = SessionResultFactory.createSelectedNotesResult(
					Array.from(selectedNotes),
				);
				this.selectAndClose(result);
			});

			this.moveAction = this.addAction(
				"folder-input",
				"Move flashcards",
				() => void this.handleMoveSelectedNotes(),
			);
			this.addToProjectAction = this.addAction(
				"folder-plus",
				"Add to project",
				() => void this.handleAddToProject(),
			);

			this.clearSelectionAction = this.addAction(
				"x-circle",
				"Clear selection",
				() => {
					this.session.clearSelection();
				},
			);
		}
	}

	private updateTitle(): void {
		const selectionCount = this.session.selectedNotes.size;
		const titleEl = this.containerEl.querySelector(".view-header-title");
		if (titleEl) {
			titleEl.textContent =
				selectionCount > 0 ? `Session (${selectionCount})` : "Session";
		}
	}

	private async handleMoveSelectedNotes(): Promise<void> {
		const selectedNotes = this.session.selectedNotes;
		if (selectedNotes.size === 0) return;

		const allCards = this.session.allCards;
		const cardsToMove = allCards.filter(
			(card) => card.sourceNoteName && selectedNotes.has(card.sourceNoteName),
		);
		if (cardsToMove.length === 0) {
			notify().warning("No flashcards found in selected notes");
			return;
		}

		const modal = new MoveCardModal(this.app, {
			cardCount: cardsToMove.length,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		let movedCount = 0;
		for (const card of cardsToMove) {
			const success = await this.plugin.flashcardManager.moveCard(
				card.id,
				result.targetNotePath,
			);
			if (success) movedCount++;
		}
		notify().cardsMoved(movedCount, result.targetNotePath);
		this.session.clearSelection();
	}

	private async handleAddToProject(): Promise<void> {
		const selectedNotes = this.session.selectedNotes;
		if (selectedNotes.size === 0) return;

		const availableProjects = Array.from(
			this.plugin.frontmatterIndex.getAllValues("projects"),
		);
		const modal = new AddToProjectModal(this.app, {
			availableProjects,
			currentProjects: [],
		});
		const result = await modal.openAndWait();
		if (result.cancelled || result.projects.length === 0) return;

		const frontmatterService =
			this.plugin.flashcardManager.getFrontmatterService();
		let updatedCount = 0;
		for (const noteName of selectedNotes) {
			const noteFile = this.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === noteName);
			if (!noteFile) continue;
			const content = await this.app.vault.cachedRead(noteFile);
			const currentProjects =
				frontmatterService.extractProjectsFromFrontmatter(content);
			const newProjects = [
				...new Set([...currentProjects, ...result.projects]),
			];
			await frontmatterService.setProjectsInFrontmatter(noteFile, newProjects);
			updatedCount++;
		}
		notify().success(`Added ${updatedCount} note(s) to project(s)`);
		this.session.clearSelection();
	}

	private selectAndClose(result: SessionResult): void {
		this.onSessionSelected?.(result);
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION);
		for (const leaf of leaves) {
			leaf.detach();
		}
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unmountPreact?.();

		this.clearSelectionAction?.remove();
		this.startSessionAction?.remove();
		this.moveAction?.remove();
		this.addToProjectAction?.remove();
	}
}
