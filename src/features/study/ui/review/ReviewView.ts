import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import { FSRSService } from "@features/core/services/fsrs.service";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { ReviewService } from "@features/study/services/review.service";
import {
	AnswerHandler,
	CardActionsHandler,
	EditHandler,
	KeyboardHandler,
} from "@features/study/ui/review/handlers";
import {
	applyMutation,
	buildQueueOptions,
	filterActiveCards,
	getEmptyQueueMessage,
} from "@features/study/ui/review/helpers";
import {
	ReviewApp,
	ReviewEmptyState,
} from "@features/study/ui/review/ReviewApp";
import {
	type SessionFilters,
	filtersFromViewState,
	filtersToViewState,
	isCustomSession,
} from "@features/study/ui/review/review.types";
import { effect } from "@preact/signals";
import { VIEW_TYPE_REVIEW } from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import { lastMutation } from "@shared/services/signals";
import type { ReviewApi } from "@shared/store";
import { extractFSRSSettings, type FSRSFlashcardItem } from "@shared/types";
import { mountPreact } from "@shared/ui/preact";
import {
	ItemView,
	Menu,
	TFile,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";
import type { Grade } from "ts-fsrs";
import type TrueRecallPlugin from "../../../../main";

export class ReviewView extends ItemView {
	private plugin: TrueRecallPlugin;
	private fsrsService: FSRSService;
	private reviewService: ReviewService;
	private flashcardManager: FlashcardManager;
	private sessionPersistence: SessionPersistenceService;

	private filters: SessionFilters = {};
	private crammedCardIds = new Set<string>();

	private answerHandler!: AnswerHandler;
	private editHandler!: EditHandler;
	private cardActionsHandler!: CardActionsHandler;
	private keyboardHandler!: KeyboardHandler;
	private unmountPreact?: () => void;
	private openNoteAction: HTMLElement | null = null;
	private unsubscribe: (() => void) | null = null;
	private sessionSignalDisposer: (() => void) | null = null;

	private get review(): ReviewApi {
		const store = this.plugin.store;
		if (!store) throw new Error("Store not initialized");
		return store.getState().review;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.flashcardManager = plugin.flashcardManager;
		this.reviewService = new ReviewService();
		this.sessionPersistence = plugin.sessionPersistence;

		const fsrsSettings = extractFSRSSettings(plugin.settings);
		this.fsrsService = new FSRSService(fsrsSettings);

		this.editHandler = new EditHandler({
			app: this.app,
			getReview: () => this.review,
			flashcardManager: this.flashcardManager,
		});

		this.answerHandler = new AnswerHandler(
			{
				getReview: () => this.review,
				plugin: this.plugin,
				fsrsService: this.fsrsService,
				reviewService: this.reviewService,
				flashcardManager: this.flashcardManager,
				sessionPersistence: this.sessionPersistence,
				getFilters: () => this.filters,
				getCrammedCardIds: () => this.crammedCardIds,
			},
			{
				onUpdateSchedulingPreview: () =>
					this.answerHandler.updateSchedulingPreview(),
			},
		);

		this.cardActionsHandler = new CardActionsHandler(
			{
				app: this.app,
				getReview: () => this.review,
				flashcardManager: this.flashcardManager,
				fsrsService: this.fsrsService,
				reviewService: this.reviewService,
				cardStore: this.plugin.cardStore,
				settings: this.plugin.settings,
				plugin: this.plugin,
			},
			{
				onUpdateSchedulingPreview: () =>
					this.answerHandler.updateSchedulingPreview(),
			},
		);

		this.keyboardHandler = new KeyboardHandler(() => this.review, {
			onShowAnswer: () => this.answerHandler.handleShowAnswer(),
			onAnswer: (rating) =>
				this.answerHandler.handleAnswer(rating as Grade),
			onUndo: async () => {
				await this.cardActionsHandler.handleUndo();
			},
			onSuspend: () => this.cardActionsHandler.handleSuspend(),
			onBuryCard: () => this.cardActionsHandler.handleBuryCard(),
			onBuryNote: () => this.cardActionsHandler.handleBuryNote(),
			onMoveCard: () => this.cardActionsHandler.handleMoveCard(),
			onAddCard: () => this.cardActionsHandler.handleAddNewFlashcard(),
			onCopyCard: () => this.cardActionsHandler.handleCopyCurrentCard(),
			onEditCard: () => this.cardActionsHandler.handleEditCardModal(),
		});
	}

	// ─── Obsidian lifecycle ──────────────────────────────────────────────

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		this.filters = filtersFromViewState(
			(state as import("./review.types").ReviewViewState) ?? null,
		);
		this.crammedCardIds.clear();

		await super.setState(state, result);
		await this.startSession();
	}

	getState() {
		return filtersToViewState(this.filters);
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW;
	}

	getDisplayText(): string {
		return "Review session";
	}

	getIcon(): string {
		return "brain";
	}

	getCurrentReviewedCard(): FSRSFlashcardItem | null {
		return this.review.getCurrentCard();
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		if (!this.plugin.store) return;
		this.unsubscribe = this.plugin.store.subscribe(
			(state) => state.review,
			() => {
				this.updateHeaderActions();

				this.mountApp(container);
			},
		);

		this.plugin.undoService?.setReviewStateManager(this.review, {
			onUpdateSchedulingPreview: () =>
				this.answerHandler.updateSchedulingPreview(),
			onUndoAnswer: (payload, writeCancelled) =>
				this.answerHandler.handleUndoAnswer(payload, writeCancelled),
		});

		this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
			const activeView = this.app.workspace.getActiveViewOfType(ReviewView);
			if (activeView !== this) return;
			if (document.querySelector(".modal-container")) return;
			this.keyboardHandler.handleKeyDown(e);
		});
	}

	private mountApp(container: HTMLElement): void {
		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(ReviewApp, {
				onShowAnswer: () => this.answerHandler.handleShowAnswer(),
				onAnswer: (rating: Grade) =>
					void this.answerHandler.handleAnswer(rating),
				onStartEdit: (field: "question" | "answer") =>
					this.editHandler.startEdit(field),
				onSaveEdit: (
					textarea: HTMLTextAreaElement,
					field: "question" | "answer",
				) => void this.editHandler.saveEditFromTextarea(textarea, field),
				onImagePaste: (file: File, textarea: HTMLTextAreaElement) =>
					void this.editHandler.handleInlineImagePaste(file, textarea),
				onOpenSourceNote: () => this.handleOpenSourceNote(),
				onClose: () => this.handleClose(),
				onNextSession: () => this.handleNextSession(),
				onEndSession: () => {
					/* handled in Preact component */
				},
				onActionsMenu: (e: MouseEvent) => this.showActionsMenu(e),
				isCustomSession: isCustomSession(this.filters),
				crammingMode: this.filters.crammingMode ?? false,
				showHeader: this.plugin.settings.showReviewHeader,
				showHeaderStats: this.plugin.settings.showReviewHeaderStats,
				showNextReviewTime: this.plugin.settings.showNextReviewTime,
				continuousCustomReviews: this.plugin.settings.continuousCustomReviews,
			}),
		);
	}

	private mountEmptyState(container: HTMLElement, message: string): void {
		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(ReviewEmptyState, {
				message,
				onClose: () => this.handleClose(),
			}),
		);
	}

	async onClose(): Promise<void> {
		this.plugin.undoService?.setReviewStateManager(null, null);
		this.plugin.undoService?.clearSessionEntries();

		if (this.plugin.cardStore) {
			await this.plugin.cardStore.flush();
		}

		this.unsubscribe?.();
		this.unsubscribeFromSessionEvents();
		this.unmountPreact?.();

		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		this.review.reset();
	}

	// ─── Header actions (Obsidian native) ────────────────────────────────

	private updateHeaderActions(): void {
		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		if (!this.review.isActive || !this.plugin.settings.showReviewHeader) {
			return;
		}

		this.openNoteAction = this.addAction("external-link", "Open note", () =>
			this.handleOpenNote(),
		);
	}

	// ─── Session lifecycle ───────────────────────────────────────────────

	async startSession(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;

		try {
			const fsrsSettings = extractFSRSSettings(this.plugin.settings);
			this.fsrsService.updateSettings(fsrsSettings);

			const allCards = this.flashcardManager.getAllFSRSCards();

			if (allCards.length === 0) {
				this.mountEmptyState(
					container,
					"No flashcards found. Generate some flashcards first!",
				);
				return;
			}

			const activeCards = filterActiveCards(allCards, {
				stateFilter: this.filters.stateFilter,
			});

			if (activeCards.length === 0) {
				const msg =
					this.filters.stateFilter === "buried"
						? "No buried cards found."
						: "All cards are suspended or buried. Unsuspend/unbury some cards to start reviewing.";
				this.mountEmptyState(container, msg);
				return;
			}

			if (!this.sessionPersistence) {
				this.sessionPersistence = this.plugin.sessionPersistence;
			}
			if (!this.sessionPersistence) {
				console.error("[ReviewView] sessionPersistence not initialized");
				this.mountEmptyState(
					container,
					"Session persistence not ready. Please try again.",
				);
				return;
			}

			const queueOptions = buildQueueOptions(
				this.filters,
				this.plugin.settings,
				this.sessionPersistence,
			);

			// Scope to project members via outgoing links
			if (this.filters.projectPath) {
				queueOptions.sourceUidFilter =
					this.plugin.projectLinkService.getSourceUidsForProject(
						this.filters.projectPath,
					);
			}

			const queue = this.reviewService.buildQueue(
				activeCards,
				this.fsrsService,
				queueOptions,
			);

			if (queue.length === 0) {
				this.mountEmptyState(
					container,
					getEmptyQueueMessage(this.filters.stateFilter),
				);
				return;
			}

			this.review.startSession(queue);
			this.subscribeToSessionEvents();
			this.answerHandler.updateSchedulingPreview();

			// Mount the Preact app now that the session is active
			this.mountApp(container);
		} catch (error) {
			console.error("Error starting review session:", error);
			notify().error(
				`Error: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// ─── Signal-based mutation handling ──────────────────────────────────

	private subscribeToSessionEvents(): void {
		this.unsubscribeFromSessionEvents();

		this.sessionSignalDisposer = effect(() => {
			const m = lastMutation.value;
			if (!m) return;
			applyMutation(
				m,
				this.review,
				this.flashcardManager,
				this.plugin.cardStore,
				this.filters,
			);
		});
	}

	private unsubscribeFromSessionEvents(): void {
		this.sessionSignalDisposer?.();
		this.sessionSignalDisposer = null;
	}

	// ─── Actions menu ────────────────────────────────────────────────────

	private showActionsMenu(event: MouseEvent): void {
		const menu = new Menu();

		if (this.cardActionsHandler.canUndo()) {
			menu.addItem((item) =>
				item
					.setTitle("Undo last answer (z)")
					.setIcon("undo")
					.onClick(() => this.cardActionsHandler.handleUndo()),
			);
			menu.addSeparator();
		}

		menu.addItem((item) =>
			item
				.setTitle("Move card (m)")
				.setIcon("folder-input")
				.onClick(() => this.cardActionsHandler.handleMoveCard()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Suspend card")
				.setIcon("pause")
				.onClick(() => this.cardActionsHandler.handleSuspend()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Bury card (-)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryCard()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Bury note (=)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryNote()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Edit card (e)")
				.setIcon("pencil")
				.onClick(() => void this.cardActionsHandler.handleEditCardModal()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Add flashcard (a)")
				.setIcon("plus")
				.onClick(() => void this.cardActionsHandler.handleAddNewFlashcard()),
		);
		menu.addItem((item) =>
			item
				.setTitle("Open source note")
				.setIcon("external-link")
				.onClick(() => this.handleOpenSourceNote()),
		);

		menu.showAtMouseEvent(event);
	}

	// ─── Navigation ──────────────────────────────────────────────────────

	private handleOpenSourceNote(): void {
		const card = this.review.getCurrentCard();
		if (!card || !card.sourceNoteName) {
			notify().warning("Source note not found");
			return;
		}

		let sourceFile: TFile | null | undefined;
		if (card.sourceUid && this.plugin.frontmatterIndex) {
			sourceFile = this.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
		}

		if (!sourceFile && card.sourceNotePath) {
			const abstractFile = this.app.vault.getAbstractFileByPath(
				card.sourceNotePath,
			);
			if (abstractFile instanceof TFile) {
				sourceFile = abstractFile;
			}
		}

		if (sourceFile) {
			void this.app.workspace.openLinkText(sourceFile.path, "", false);
		} else {
			notify().warning(`Source note "${card.sourceNoteName}" not found`);
		}
	}

	private handleOpenNote(): void {
		const card = this.review.getCurrentCard();
		if (!card) return;

		if (card.sourceNoteName) {
			this.handleOpenSourceNote();
		} else {
			notify().info("This card has no associated source note");
		}
	}

	private handleClose(): void {
		this.leaf.detach();
	}

	private handleNextSession(): void {
		this.leaf.detach();
		void this.plugin.activateView();
	}
}
