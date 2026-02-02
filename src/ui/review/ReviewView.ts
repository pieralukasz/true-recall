/**
 * Review View
 * Main view for spaced repetition review sessions
 * Can be displayed in fullscreen (main area) or panel (sidebar)
 */
import {
	ItemView,
	WorkspaceLeaf,
	MarkdownRenderer,
	Platform,
	Menu,
	setIcon,
	TFile,
	type ViewStateResult,
} from "obsidian";
import { Rating, State, type Grade } from "ts-fsrs";
import { VIEW_TYPE_REVIEW, UI_CONFIG } from "../../constants";
import {
	FSRSService,
	ReviewService,
	FlashcardManager,
	SessionPersistenceService,
	getEventBus,
	notify,
} from "../../services";
import { ImageService } from "../../services/image";
import { ReviewStateManager } from "../../state";
import { extractFSRSSettings, type FSRSFlashcardItem } from "../../types";
import type {
	CardAddedEvent,
	CardRemovedEvent,
	CardUpdatedEvent,
	BulkChangeEvent,
	ReviewCardChangedEvent,
	CardReviewedEvent,
} from "../../types/events.types";
import { SubscriptionManager } from "../utils";
import type TrueRecallPlugin from "../../main";
import type { ReviewViewState } from "./review.types";
import { CardActionsHandler, KeyboardHandler } from "./handlers";
import { CardContent, CardBacklink, CardProjects } from "./components";
import {
	filterActiveCards,
	buildSourceUidToProjectsMap,
	getEmptyQueueMessage,
} from "./helpers";
import { CopilotIntegrationService } from "../../services/integration/copilot-integration.service";

export class ReviewView extends ItemView {
	// Pre-compiled regex for converting legacy <br> tags (avoid recompiling on every render)
	private static readonly BR_REGEX = /<br\s*\/?>/gi;

	private plugin: TrueRecallPlugin;
	private fsrsService: FSRSService;
	private reviewService: ReviewService;
	private flashcardManager: FlashcardManager;
	private stateManager: ReviewStateManager;
	private sessionPersistence: SessionPersistenceService;

	// Project filter (empty = all projects)
	private projectFilters: string[] = [];

	// Track which cards have projects expanded
	private expandedProjects: Set<string> = new Set();

	// Track if this is a custom review session (with filters)
	private isCustomSession: boolean = false;

	// Custom session filters
	private sourceNoteFilter?: string;
	private sourceNoteFilters?: string[];
	private filePathFilter?: string;
	private createdTodayOnly?: boolean;
	private createdThisWeek?: boolean;
	private weakCardsOnly?: boolean;
	private stateFilter?: "due" | "learning" | "new" | "buried";
	private ignoreDailyLimits?: boolean;
	private bypassScheduling?: boolean;

	// Handlers (initialized in constructor)
	private cardActionsHandler!: CardActionsHandler;
	private keyboardHandler!: KeyboardHandler;

	// UI Components (extracted for better separation of concerns)
	private cardContent!: CardContent;
	private cardBacklink!: CardBacklink;
	private cardProjects!: CardProjects;

	// Image service for paste handling
	private imageService!: ImageService;

	// Copilot integration service
	private copilotService!: CopilotIntegrationService;

	// Track last card ID to avoid repeated Copilot context additions
	private lastCopilotContextCardId: string | null = null;

	// UI Elements
	private headerEl!: HTMLElement;
	private cardContainerEl!: HTMLElement;
	private buttonsEl!: HTMLElement;

	// Native header action elements
	private openNoteAction: HTMLElement | null = null;

	// State subscription
	private unsubscribe: (() => void) | null = null;

	// Consolidated subscription/timer management
	private subs = new SubscriptionManager();

	// Reference to waiting timer for countdown updates
	private waitingTimerId: ReturnType<typeof setInterval> | null = null;

	// AbortController for cleaning up event listeners between renders
	private cardEventAbortController: AbortController | null = null;

	// Render optimization: track last rendered state to avoid unnecessary re-renders
	private lastRenderedCardId: string | null = null;
	private lastRenderedAnswerRevealed: boolean = false;
	private lastRenderedEditState: boolean = false;
	private lastRenderedQuestion: string | null = null;
	private lastRenderedAnswer: string | null = null;
	private lastRenderedBadgeCounts: { new: number; learning: number; due: number } | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.flashcardManager = plugin.flashcardManager;
		this.stateManager = new ReviewStateManager();
		this.reviewService = new ReviewService();
		this.sessionPersistence = plugin.sessionPersistence;

		// Initialize FSRS service with current settings
		const fsrsSettings = extractFSRSSettings(plugin.settings);
		this.fsrsService = new FSRSService(fsrsSettings);

		// Initialize image service for paste handling
		this.imageService = new ImageService(this.app);

		// Initialize Copilot integration service
		this.copilotService = new CopilotIntegrationService(this.app);

		// Initialize CardActionsHandler
		this.cardActionsHandler = new CardActionsHandler(
			{
				app: this.app,
				stateManager: this.stateManager,
				flashcardManager: this.flashcardManager,
				fsrsService: this.fsrsService,
				reviewService: this.reviewService,
				cardStore: this.plugin.cardStore,
				settings: this.plugin.settings,
				plugin: this.plugin,
			},
			{
				onUpdateSchedulingPreview: () => this.updateSchedulingPreview(),
			}
		);

		// Initialize KeyboardHandler
		this.keyboardHandler = new KeyboardHandler(this.stateManager, {
			onShowAnswer: () => this.handleShowAnswer(),
			onAnswer: (rating) => this.handleAnswer(rating as Grade),
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
			onZoomIn: () => this.handleZoom(0.1),
			onZoomOut: () => this.handleZoom(-0.1),
		});

		// Initialize UI components
		this.cardContent = new CardContent(
			{ app: this.app, component: this },
			{
				onStartEdit: (field) => this.startEdit(field),
				onSaveEdit: (textarea, field) =>
					this.saveEditFromTextarea(textarea, field),
				onImagePaste: (file, textarea) =>
					this.handleInlineImagePaste(file, textarea),
				isAnswerRevealed: () => this.stateManager.isAnswerRevealed(),
			}
		);

		this.cardBacklink = new CardBacklink({
			onOpenSource: () => this.handleOpenSourceNote(),
		});

		this.cardProjects = new CardProjects({
			onToggleProjects: (cardId) => {
				this.expandedProjects.add(cardId);
				this.renderCard();
			},
			onOpenProject: (project) => this.handleProjectClick(project),
		});
	}

	/**
	 * Set view state (including project filters and custom session filters)
	 */
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const viewState = state as ReviewViewState | null;
		this.projectFilters = viewState?.projectFilters ?? [];
		this.sourceNoteFilter = viewState?.sourceNoteFilter;
		this.sourceNoteFilters = viewState?.sourceNoteFilters;
		this.filePathFilter = viewState?.filePathFilter;
		this.createdTodayOnly = viewState?.createdTodayOnly;
		this.createdThisWeek = viewState?.createdThisWeek;
		this.weakCardsOnly = viewState?.weakCardsOnly;
		this.stateFilter = viewState?.stateFilter;
		this.ignoreDailyLimits = viewState?.ignoreDailyLimits;
		this.bypassScheduling = viewState?.bypassScheduling;

		// Detect if this is a custom review session (any custom filter is set)
		this.isCustomSession = !!(
			viewState?.sourceNoteFilter ||
			(viewState?.sourceNoteFilters &&
				viewState.sourceNoteFilters.length > 0) ||
			viewState?.filePathFilter ||
			viewState?.createdTodayOnly ||
			viewState?.createdThisWeek ||
			viewState?.weakCardsOnly ||
			viewState?.stateFilter
		);

		await super.setState(state, result);

		// Start session after filters are set
		await this.startSession();
	}

	/**
	 * Get current view state
	 */
	getState(): ReviewViewState {
		return {
			projectFilters: this.projectFilters,
			sourceNoteFilter: this.sourceNoteFilter,
			sourceNoteFilters: this.sourceNoteFilters,
			filePathFilter: this.filePathFilter,
			createdTodayOnly: this.createdTodayOnly,
			createdThisWeek: this.createdThisWeek,
			weakCardsOnly: this.weakCardsOnly,
			stateFilter: this.stateFilter,
			ignoreDailyLimits: this.ignoreDailyLimits,
			bypassScheduling: this.bypassScheduling,
		};
	}

	getViewType(): string {
		return VIEW_TYPE_REVIEW;
	}

	getDisplayText(): string {
		return "Review Session";
	}

	getIcon(): string {
		return "brain";
	}

	/**
	 * Get the currently reviewed card (for external access, e.g., copy to add panel)
	 */
	getCurrentReviewedCard(): FSRSFlashcardItem | null {
		return this.stateManager.getCurrentCard();
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass(
			"true-recall-review",
			"ep:flex",
			"ep:flex-col",
			"ep:h-full",
			"ep:p-0"
		);

		// Add scoped styles for font scaling
		const styleEl = container.createEl("style");
		styleEl.textContent = `
			.true-recall-review-question,
			.true-recall-review-answer {
				font-size: calc(1em * var(--review-font-scale, 1));
			}
		`;

		// Create UI structure
		this.headerEl = container.createDiv({
			cls: "ep:flex ep:justify-center ep:items-center ep:border-b ep:border-obs-border ep:relative ep:shrink-0 ep:p-2 ep:pb-4",
		});
		this.cardContainerEl = container.createDiv({
			cls: "true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:p-2 ep:mt-8 ep:overflow-y-auto",
		});

		// Delegated click handler for all card interactions
		// Uses event delegation pattern for better performance (single listener vs many)
		this.cardContainerEl.addEventListener("click", (e: MouseEvent) => {
			const target = e.target as HTMLElement;

			// Clear text selection when clicking outside content
			if (target === this.cardContainerEl) {
				window.getSelection()?.removeAllRanges();
				return;
			}

			// Handle data-action clicks (open-source, toggle-projects, open-project)
			const actionEl = target.closest("[data-action]") as HTMLElement | null;
			if (actionEl) {
				const action = actionEl.dataset.action;
				if (action === "open-source") {
					this.handleOpenSourceNote();
					return;
				}
				if (action === "toggle-projects") {
					const cardId = actionEl.dataset.cardId;
					if (cardId) {
						this.expandedProjects.add(cardId);
						this.renderCard();
					}
					return;
				}
				if (action === "open-project") {
					const project = actionEl.dataset.project;
					if (project) {
						this.handleProjectClick(project);
					}
					return;
				}
			}

			// Handle field clicks (question/answer) for internal links and edit mode
			const fieldEl = target.closest("[data-field]") as HTMLElement | null;
			if (fieldEl) {
				const field = fieldEl.dataset.field as "question" | "answer" | undefined;
				const sourcePath = fieldEl.dataset.sourcePath || "";
				if (field) {
					this.handleFieldClick(e, field, sourcePath);
				}
			}
		});

		this.buttonsEl = container.createDiv({
			cls: "true-recall-review-buttons ep:flex ep:justify-center ep:gap-3 ep:border-t ep:border-obs-border ep:flex-nowrap ep:shrink-0 ep:p-4",
		});

		// Apply saved font scale
		this.applyFontScale();

		// Subscribe to state changes - update render and header actions
		this.unsubscribe = this.stateManager.subscribe(() => {
			this.render();
			this.updateHeaderActions();
		});

		// Subscribe to EventBus for cross-component reactivity
		this.subscribeToEvents();

		// Register ReviewStateManager with global UndoService for review undo support
		this.plugin.undoService?.setReviewStateManager(this.stateManager, {
			onUpdateSchedulingPreview: () => this.updateSchedulingPreview(),
			onUndoAnswer: (payload) => this.handleUndoAnswerFromService(payload),
		});

		// Re-emit card changed event when this view becomes active again
		// This syncs the flashcard panel back to review when user returns to this view
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf && this.stateManager.isActive()) {
					this.emitCardChangedEvent();
				}
			})
		);

		// Register keyboard shortcuts using the KeyboardHandler
		this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
			// Only handle when this view is active
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf?.view !== this) return;

			// Skip if modal is open
			if (document.querySelector(".modal-container")) return;

			this.keyboardHandler.handleKeyDown(e);
		});

		// Note: startSession() is called from setState() after filters are applied
	}

	/**
	 * Update native header actions based on current session state
	 */
	private updateHeaderActions(): void {
		// Remove existing actions
		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		// Only show actions when session is active and header is shown
		if (
			!this.stateManager.isActive() ||
			!this.plugin.settings.showReviewHeader
		) {
			return;
		}

		// Open note action
		this.openNoteAction = this.addAction("external-link", "Open note", () =>
			this.handleOpenNote()
		);
	}

	async onClose(): Promise<void> {
		// Notify panel that review session ended
		this.emitCardChangedEvent();

		// Unregister ReviewStateManager from global UndoService
		this.plugin.undoService?.setReviewStateManager(null, null);

		// Clear session-specific undo entries to prevent memory accumulation
		this.plugin.undoService?.clearSessionEntries();

		// Flush store to disk before closing
		if (this.plugin.cardStore) {
			await this.plugin.cardStore.flush();
		}

		this.unsubscribe?.();

		// Cleanup all EventBus subscriptions and timers via SubscriptionManager
		this.subs.dispose();

		// Cleanup card event listeners via AbortController
		this.cardEventAbortController?.abort();
		this.cardEventAbortController = null;

		// Cleanup UI components
		this.cardContent.destroy();

		// Remove native header actions
		if (this.openNoteAction) {
			this.openNoteAction.remove();
			this.openNoteAction = null;
		}

		this.stateManager.reset();
	}

	/**
	 * Subscribe to EventBus events for cross-component reactivity
	 * Handles card removal during active review sessions
	 */
	private subscribeToEvents(): void {
		const eventBus = getEventBus();

		// Handle card removal during active review
		this.subs.track(
			eventBus.on<CardRemovedEvent>("card:removed", (event) => {
				if (!this.stateManager.isActive()) return;

				// Check if removed card is in our queue
				const queue = this.stateManager.getState().queue;
				const cardInQueue = queue.find((c) => c.id === event.cardId);

				if (cardInQueue) {
					// Remove card from queue - triggers notifyListeners() → render
					this.stateManager.removeCardById(event.cardId);
				}
			})
		);

		// Handle card content updates during review
		this.subs.track(
			eventBus.on<CardUpdatedEvent>("card:updated", (event) => {
				if (!this.stateManager.isActive()) return;
				if (!event.changes.question && !event.changes.answer) return;

				// If current card was updated externally, reload from database
				const currentCard = this.stateManager.getCurrentCard();
				if (currentCard && currentCard.id === event.cardId) {
					// Reload card content from database (needed for undo to show reverted content)
					const updatedData = this.plugin.cardStore.get(event.cardId);
					if (updatedData) {
						// updateCurrentCardContent triggers notifyListeners() → render
						this.stateManager.updateCurrentCardContent(
							updatedData.question ?? currentCard.question,
							updatedData.answer ?? currentCard.answer
						);
					}
				}
			})
		);

		// Handle bulk removals (e.g., from diff apply)
		this.subs.track(
			eventBus.on<BulkChangeEvent>("cards:bulk-change", (event) => {
				if (!this.stateManager.isActive()) return;
				if (event.action !== "removed") return;

				// Remove all deleted cards in one batch operation (single render)
				const queue = this.stateManager.getState().queue;
				const queueIds = new Set(queue.map((c) => c.id));
				const idsToRemove = event.cardIds.filter((id) => queueIds.has(id));
				if (idsToRemove.length > 0) {
					this.stateManager.removeCardsByIds(idsToRemove);
				}
			})
		);

		// Handle new cards being added during review (e.g., from floating button)
		this.subs.track(
			eventBus.on<CardAddedEvent>("card:added", (event) => {
				if (!this.stateManager.isActive()) return;

				// Fetch the new card data
				const cards = this.flashcardManager.getCardsByIds([event.cardId]);
				const newCard = cards[0];
				if (!newCard) return;

				// Check if card matches current session filters
				if (this.sourceNoteFilter && newCard.sourceNoteName !== this.sourceNoteFilter) {
					return;
				}
				if (this.sourceNoteFilters && this.sourceNoteFilters.length > 0) {
					if (!this.sourceNoteFilters.includes(newCard.sourceNoteName ?? "")) {
						return;
					}
				}

				// Add card to queue and update UI
				this.stateManager.addCardToQueue(newCard);
				this.renderHeader();
			})
		);
	}

	/**
	 * Clear the waiting screen timer
	 */
	private clearWaitingTimer(): void {
		if (this.waitingTimerId) {
			this.subs.clearInterval(this.waitingTimerId);
			this.waitingTimerId = null;
		}
	}

	/**
	 * Start a new review session
	 */
	async startSession(): Promise<void> {
		try {
			// Update FSRS service with latest settings
			const fsrsSettings = extractFSRSSettings(this.plugin.settings);
			this.fsrsService.updateSettings(fsrsSettings);

			// Get all cards
			const allCards = await this.flashcardManager.getAllFSRSCards();

			if (allCards.length === 0) {
				this.renderEmptyState(
					"No flashcards found. Generate some flashcards first!"
				);
				return;
			}

			// Filter out suspended and buried cards (using helper)
			const activeCards = filterActiveCards(allCards, {
				stateFilter: this.stateFilter,
			});

			if (activeCards.length === 0) {
				if (this.stateFilter === "buried") {
					this.renderEmptyState("No buried cards found.");
				} else {
					this.renderEmptyState(
						"All cards are suspended or buried. Unsuspend/unbury some cards to start reviewing."
					);
				}
				return;
			}

			// Get persistent stats for today
			if (!this.sessionPersistence) {
				this.sessionPersistence = this.plugin.sessionPersistence;
			}
			if (!this.sessionPersistence) {
				console.error("[ReviewView] sessionPersistence not initialized");
				this.renderEmptyState("Session persistence not ready. Please try again.");
				return;
			}
			const reviewedToday = await this.sessionPersistence.getReviewedToday();
			const newCardsStudiedToday = await this.sessionPersistence.getNewCardsStudiedToday();

			// Build sourceUidToProjects map for project filtering (using helper)
			const sourceUidToProjects = buildSourceUidToProjectsMap(
				this.app,
				this.projectFilters
			);

			// Build review queue with persistent stats, project filters, custom session filters, and display order settings
			const queue = this.reviewService.buildQueue(
				activeCards,
				this.fsrsService,
				{
					newCardsLimit: this.plugin.settings.newCardsPerDay,
					reviewsLimit: this.plugin.settings.reviewsPerDay,
					reviewedToday,
					newCardsStudiedToday,
					projectFilters: this.projectFilters,
					sourceUidToProjects,
					newCardOrder: this.plugin.settings.newCardOrder,
					reviewOrder: this.plugin.settings.reviewOrder,
					newReviewMix: this.plugin.settings.newReviewMix,
					dayStartHour: this.plugin.settings.dayStartHour,
					// Custom session filters
					sourceNoteFilter: this.sourceNoteFilter,
					sourceNoteFilters: this.sourceNoteFilters,
					filePathFilter: this.filePathFilter,
					createdTodayOnly: this.createdTodayOnly,
					createdThisWeek: this.createdThisWeek,
					weakCardsOnly: this.weakCardsOnly,
					stateFilter: this.stateFilter,
					ignoreDailyLimits: this.ignoreDailyLimits,
					bypassScheduling: this.bypassScheduling,
				}
			);

			if (queue.length === 0) {
				// Diagnostic logging for project filter debugging
				if (this.projectFilters && this.projectFilters.length > 0) {
					console.log("[ReviewView] Project filter active but queue empty");
					console.log("[ReviewView] projectFilters:", this.projectFilters);
					console.log("[ReviewView] sourceUidToProjects size:", sourceUidToProjects?.size ?? 0);
					console.log("[ReviewView] activeCards count:", activeCards.length);
				}
				this.renderEmptyState(
					getEmptyQueueMessage(this.stateFilter, this.projectFilters)
				);
				return;
			}

			// Start session
			this.stateManager.startSession(queue);

			// Notify panel of first card
			this.emitCardChangedEvent();

			// Calculate scheduling preview for first card
			this.updateSchedulingPreview();
		} catch (error) {
			console.error("Error starting review session:", error);
			notify().error(
				`Error: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 * Render the current state using state machine pattern
	 * Uses selective re-rendering to avoid unnecessary DOM operations
	 */
	private render(): void {
		const phase = this.stateManager.getPhase();

		// Handle non-active phases with early return
		switch (phase.type) {
			case "idle":
				this.lastRenderedCardId = null;
				this.lastRenderedQuestion = null;
				this.lastRenderedAnswer = null;
				return;

			case "complete":
				this.stateManager.endSession();
				this.renderSummary();
				this.lastRenderedCardId = null;
				this.lastRenderedQuestion = null;
				this.lastRenderedAnswer = null;
				return;

			case "waiting":
				this.renderWaitingScreen();
				this.lastRenderedCardId = null;
				this.lastRenderedQuestion = null;
				this.lastRenderedAnswer = null;
				return;

			case "active":
				// Continue to active card rendering below
				break;
		}

		// Clear waiting timer when showing a card
		this.clearWaitingTimer();

		const currentCard = phase.card;
		const answerRevealed = this.stateManager.isAnswerRevealed();
		const editState = this.stateManager.getEditState();

		// Determine what needs to be re-rendered
		const cardChanged = currentCard.id !== this.lastRenderedCardId;
		const answerJustRevealed = answerRevealed && !this.lastRenderedAnswerRevealed;
		const editStateChanged = editState.active !== this.lastRenderedEditState;
		const contentChanged = currentCard.question !== this.lastRenderedQuestion ||
			currentCard.answer !== this.lastRenderedAnswer;

		// Header always updates (badge counts change)
		if (this.plugin.settings.showReviewHeader) {
			this.headerEl.style.display = "";
			this.renderHeader();
		} else {
			this.headerEl.style.display = "none";
			this.headerEl.empty();
		}

		// Card content: only re-render if card changed, answer revealed, edit state changed, or content changed
		if (cardChanged || answerJustRevealed || editStateChanged || contentChanged) {
			this.renderCard();
		}

		// Buttons always update (scheduling preview changes, answer reveal state)
		this.renderButtons();

		// Update tracking state
		this.lastRenderedCardId = currentCard.id;
		this.lastRenderedAnswerRevealed = answerRevealed;
		this.lastRenderedEditState = editState.active;
		this.lastRenderedQuestion = currentCard.question;
		this.lastRenderedAnswer = currentCard.answer;
	}

	/**
	 * Render header with stats badges
	 * Action buttons are now in the native Obsidian header via addAction()
	 */
	private renderHeader(): void {
		// Stats badges (centered) - O(1) access from StateManager
		if (!this.plugin.settings.showReviewHeaderStats) {
			this.headerEl.empty();
			this.lastRenderedBadgeCounts = null;
			return;
		}

		const counts = this.stateManager.getBadgeCounts();

		// Skip re-render if counts haven't changed (memoization)
		if (
			this.lastRenderedBadgeCounts &&
			this.lastRenderedBadgeCounts.new === counts.new &&
			this.lastRenderedBadgeCounts.learning === counts.learning &&
			this.lastRenderedBadgeCounts.due === counts.due
		) {
			return;
		}

		this.headerEl.empty();
		this.lastRenderedBadgeCounts = { ...counts };

		const statsContainer = this.headerEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1.5",
		});
		this.renderHeaderStatBadge(statsContainer, "new", counts.new);
		this.renderHeaderStatBadge(statsContainer, "learning", counts.learning);
		this.renderHeaderStatBadge(statsContainer, "due", counts.due);
	}

	/**
	 * Render a single stat badge in the header
	 */
	private renderHeaderStatBadge(
		container: HTMLElement,
		type: "new" | "learning" | "due",
		count: number
	): void {
		const typeColors = {
			new: "ep:bg-green-500/20 ep:text-green-500",
			learning: "ep:bg-orange-500/20 ep:text-orange-500",
			due: "ep:bg-blue-500/20 ep:text-blue-500",
		};
		const badge = container.createDiv({
			cls: `ep:flex ep:items-center ep:justify-center ep:min-w-5 ep:h-5 ep:px-1.5 ep:rounded-full ep:text-ui-smaller ep:font-semibold ${typeColors[type]}`,
		});
		badge.createSpan({ text: String(count) });
	}

	/**
	 * Add source note to Copilot context if enabled
	 */
	private async addSourceToCopilotContext(
		card: FSRSFlashcardItem
	): Promise<void> {
		// Check if feature is enabled
		if (!this.plugin.settings.copilotAutoContext) return;

		// Check if Copilot is available
		if (!this.copilotService.isAvailable()) return;

		// Skip if we already added this card's source to context
		if (this.lastCopilotContextCardId === card.id) return;

		// Need a source to add
		if (!card.sourceUid) return;

		// Find the source file using frontmatter index
		const sourceFile = this.plugin.frontmatterIndex?.getFileByValue(
			"flashcard_uid",
			card.sourceUid
		);
		if (!sourceFile) return;

		// Try to add to context
		const success = await this.copilotService.addNoteToContext(sourceFile);
		if (success) {
			this.lastCopilotContextCardId = card.id;
			console.debug(
				`[ReviewView] Added source note to Copilot context: ${sourceFile.path}`
			);
		}
	}

	/**
	 * Render the current flashcard
	 * Delegates to extracted components for better separation of concerns
	 */
	private renderCard(): void {
		const card = this.stateManager.getCurrentCard();
		if (!card) {
			this.cardContainerEl.empty();
			return;
		}

		// Add source note to Copilot context (async, fire-and-forget)
		void this.addSourceToCopilotContext(card);

		const editState = this.stateManager.getEditState();
		const isAnswerRevealed = this.stateManager.isAnswerRevealed();

		// Render question and answer using CardContent component
		this.cardContent.render(
			this.cardContainerEl,
			card,
			editState,
			isAnswerRevealed
		);

		// Render backlink and projects only when answer revealed and not editing
		if (isAnswerRevealed && !editState.active) {
			// Get the card element created by CardContent
			const cardEl = this.cardContainerEl.querySelector(".ep\\:w-full");
			if (cardEl instanceof HTMLElement) {
				this.cardBacklink.render(cardEl, card.sourceNoteName ?? null);
				this.cardProjects.render(
					cardEl,
					card.id,
					card.projects,
					this.expandedProjects.has(card.id)
				);
			}
		}
	}

	/**
	 * Handle click on question/answer field
	 * - Normal click on backlink = navigate to note
	 * - Cmd/Ctrl+click anywhere = start edit mode
	 */
	private handleFieldClick(
		e: MouseEvent,
		field: "question" | "answer",
		filePath: string
	): void {
		const target = e.target;
		if (!(target instanceof HTMLElement)) return;
		const linkEl = target.closest("a.internal-link");

		if (linkEl) {
			e.preventDefault();
			e.stopPropagation();
			const href = linkEl.getAttribute("data-href");

			if (e.metaKey || e.ctrlKey) {
				// Cmd/Ctrl+click on link = edit mode
				this.startEdit(field);
			} else if (href) {
				// Normal click on link = navigate to note
				// Use getMostRecentLeaf to find an existing leaf (not the review view)
				const existingLeaf = this.app.workspace.getMostRecentLeaf();
				if (existingLeaf && existingLeaf !== this.leaf) {
					// Open in existing leaf
					void this.app.workspace.openLinkText(href, filePath, false);
				} else {
					// No suitable existing leaf, open in new tab
					void this.app.workspace.openLinkText(href, filePath, "tab");
				}
			}
		} else if (e.metaKey || e.ctrlKey) {
			// Cmd/Ctrl+click outside link = edit mode
			this.startEdit(field);
		}
	}

	/**
	 * Start editing a field (question or answer)
	 */
	private startEdit(field: "question" | "answer"): void {
		// Don't start editing answer if not revealed
		if (field === "answer" && !this.stateManager.isAnswerRevealed()) {
			return;
		}
		this.stateManager.startEdit(field);
		this.cardContainerEl.addClass(
			"true-recall-review-card-container--editing"
		);
		this.renderCard();
		this.renderButtons(); // Hide buttons when entering edit mode (prevents keyboard overlap on mobile)
	}

	/**
	 * Handle pasted image in inline edit - save to vault and insert markdown
	 */
	private async handleInlineImagePaste(
		file: File,
		textarea: HTMLTextAreaElement
	): Promise<void> {
		try {
			const savedPath = await this.imageService.saveImageFromClipboard(file);
			if (!savedPath) {
				notify().warning("Failed to save image");
				return;
			}

			const markdown = this.imageService.buildImageMarkdown(savedPath, 500);
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const value = textarea.value;

			textarea.value = value.substring(0, start) + markdown + value.substring(end);
			textarea.selectionStart = textarea.selectionEnd = start + markdown.length;
			textarea.dispatchEvent(new Event("input", { bubbles: true }));
		} catch (error) {
			console.error("Error saving image:", error);
			notify().operationFailed("save image", error);
		}
	}

	/**
	 * Save the current edit from textarea
	 */
	private async saveEditFromTextarea(
		textarea: HTMLTextAreaElement,
		field: "question" | "answer"
	): Promise<void> {
		const card = this.stateManager.getCurrentCard();
		const editState = this.stateManager.getEditState();
		if (!card || !editState.active) return;

		// Capture card ID before async operation to prevent race conditions
		const cardIdBeforeSave = card.id;

		// Keep newlines as-is (no <br> conversion)
		const newContent = textarea.value;
		const newQuestion = field === "question" ? newContent : card.question;
		const newAnswer = field === "answer" ? newContent : card.answer;

		// Only save if content actually changed
		// Compare with normalized content (convert legacy <br> to newlines for comparison)
		const normalizedOriginal = field === "question"
			? editState.originalQuestion.replace(ReviewView.BR_REGEX, "\n")
			: editState.originalAnswer.replace(ReviewView.BR_REGEX, "\n");
		const hasChanges = newContent !== normalizedOriginal;

		if (hasChanges) {
			try {
				// Update card directly in database
				this.plugin.cardStore.cards.updateCardContent(
					cardIdBeforeSave,
					newQuestion,
					newAnswer
				);

				// Validate that current card is still the same before updating state
				const currentCard = this.stateManager.getCurrentCard();
				if (currentCard?.id === cardIdBeforeSave) {
					// Update card in state
					this.stateManager.updateCurrentCardContent(
						newQuestion,
						newAnswer
					);
					notify().cardUpdated();
				}
				// If card changed during save, database is already updated but we don't update stale state
			} catch (error) {
				console.error("Error saving card content:", error);
				notify().operationFailed("save card", error);
			}
		}

		// Exit edit mode
		this.stateManager.cancelEdit();
		this.cardContainerEl.removeClass(
			"true-recall-review-card-container--editing"
		);
		this.renderCard();
		this.renderButtons(); // Restore buttons after exiting edit mode
	}

	/**
	 * Render answer buttons
	 */
	private renderButtons(): void {
		const isEditing = this.stateManager.getEditState().active;
		const answerRevealed = this.stateManager.isAnswerRevealed();
		const currentCardId = this.stateManager.getCurrentCard()?.id ?? null;

		// Hide buttons when in edit mode (prevents keyboard from pushing buttons up on mobile)
		if (isEditing) {
			this.buttonsEl.style.display = "none";
			return;
		}
		this.buttonsEl.style.display = "";

		// Skip re-render if nothing relevant has changed
		// Buttons need re-render when: card changes, answer revealed, or returning from edit mode
		const cardChanged = currentCardId !== this.lastRenderedCardId;
		const answerJustRevealed = answerRevealed && !this.lastRenderedAnswerRevealed;
		const editEnded = !isEditing && this.lastRenderedEditState;

		if (
			this.buttonsEl.children.length > 0 &&
			!cardChanged &&
			!answerJustRevealed &&
			!editEnded
		) {
			return;
		}

		this.buttonsEl.empty();

		// Create wrapper for buttons layout
		const buttonsWrapper = this.buttonsEl.createDiv({
			cls: "ep:flex ep:items-center ep:justify-center ep:w-full ep:relative",
		});

		// Main buttons container (left/center)
		const mainButtonsEl = buttonsWrapper.createDiv({
			cls: "ep:flex ep:justify-center ep:gap-3 ep:flex-nowrap ep:py-4",
		});

		// Base button class for all review buttons
		const baseBtnCls =
			"ep:flex ep:flex-col ep:items-center ep:gap-1 !ep:py-4 ep:px-6 ep:h-auto ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:min-w-20 ep:whitespace-nowrap ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

		if (!this.stateManager.isAnswerRevealed()) {
			// Show answer button
			const showBtn = mainButtonsEl.createEl("button", {
				cls: `${baseBtnCls} mod-cta ep:py-2 ep:px-4`,
				text: "Show answer",
			});
			showBtn.addEventListener("click", () => this.handleShowAnswer());
		} else {
			// Rating buttons
			const preview = this.stateManager.getSchedulingPreview();
			this.renderRatingButton(
				mainButtonsEl,
				"Again",
				Rating.Again,
				`${baseBtnCls} ep:bg-red-500 ep:text-white`,
				preview?.again.interval
			);
			this.renderRatingButton(
				mainButtonsEl,
				"Hard",
				Rating.Hard,
				`${baseBtnCls} ep:bg-orange-500 ep:text-white`,
				preview?.hard.interval
			);
			this.renderRatingButton(
				mainButtonsEl,
				"Good",
				Rating.Good,
				`${baseBtnCls} ep:bg-green-500 ep:text-white`,
				preview?.good.interval
			);
			this.renderRatingButton(
				mainButtonsEl,
				"Easy",
				Rating.Easy,
				`${baseBtnCls} ep:bg-cyan-500 ep:text-white`,
				preview?.easy.interval
			);
		}

		// Actions menu button (always visible)
		const menuBtn = buttonsWrapper.createEl("button", {
			cls: "ep:flex ep:items-center ep:justify-center ep:w-10 ep:h-10 ep:p-0 ep:border-none ep:rounded-lg ep:bg-obs-modifier-hover ep:text-obs-muted ep:cursor-pointer ep:transition-colors ep:absolute ep:right-0 ep:hover:bg-obs-border ep:hover:text-obs-normal ep:active:scale-95",
			attr: { "aria-label": "Card actions" },
		});
		setIcon(menuBtn, "more-vertical");
		menuBtn.addEventListener("click", (e) => this.showActionsMenu(e));
	}

	/**
	 * Show actions menu for current card
	 */
	private showActionsMenu(event: MouseEvent): void {
		const menu = new Menu();

		// Only show undo if there's something to undo
		if (this.cardActionsHandler.canUndo()) {
			menu.addItem((item) =>
				item
					.setTitle("Undo Last Answer (Z)")
					.setIcon("undo")
					.onClick(() => this.cardActionsHandler.handleUndo())
			);
			menu.addSeparator();
		}

		menu.addItem((item) =>
			item
				.setTitle("Move Card (M)")
				.setIcon("folder-input")
				.onClick(() => this.cardActionsHandler.handleMoveCard())
		);

		menu.addItem((item) =>
			item
				.setTitle("Suspend card")
				.setIcon("pause")
				.onClick(() => this.cardActionsHandler.handleSuspend())
		);

		menu.addItem((item) =>
			item
				.setTitle("Bury Card (-)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryCard())
		);

		menu.addItem((item) =>
			item
				.setTitle("Bury Note (=)")
				.setIcon("eye-off")
				.onClick(() => this.cardActionsHandler.handleBuryNote())
		);

		menu.addItem((item) =>
			item
				.setTitle("Edit Card (E)")
				.setIcon("pencil")
				.onClick(
					() => void this.cardActionsHandler.handleEditCardModal()
				)
		);

		menu.addItem((item) =>
			item
				.setTitle("Add Flashcard (A)")
				.setIcon("plus")
				.onClick(
					() => void this.cardActionsHandler.handleAddNewFlashcard()
				)
		);

		menu.addItem((item) =>
			item
				.setTitle("Open Source Note")
				.setIcon("external-link")
				.onClick(() => this.handleOpenSourceNote())
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Open the source note (not the flashcard file)
	 */
	private handleOpenSourceNote(): void {
		const card = this.stateManager.getCurrentCard();
		if (!card || !card.sourceNoteName) {
			notify().warning("Source note not found");
			return;
		}

		// Use frontmatterIndex for O(1) lookup instead of O(N) vault scan
		let sourceFile: TFile | null | undefined;
		if (card.sourceUid && this.plugin.frontmatterIndex) {
			sourceFile = this.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid
			);
		}

		// Fallback to path-based lookup if frontmatterIndex unavailable or failed
		if (!sourceFile && card.sourceNotePath) {
			const abstractFile = this.app.vault.getAbstractFileByPath(card.sourceNotePath);
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

	/**
	 * Handle project badge click - opens projects view
	 */
	private handleProjectClick(_projectName: string): void {
		void this.plugin.activateProjectsView();
	}

	/**
	 * Render a single rating button
	 */
	private renderRatingButton(
		container: HTMLElement,
		label: string,
		rating: Grade,
		cls: string,
		interval?: string
	): void {
		const btn = container.createEl("button", { cls });

		btn.createDiv({ cls: "ep:font-semibold", text: label });

		if (interval && this.plugin.settings.showNextReviewTime) {
			btn.createDiv({
				cls: "ep:text-ui-smaller ep:opacity-90",
				text: interval,
			});
		}

		btn.addEventListener("click", () => this.handleAnswer(rating));
	}

	/**
	 * Render empty state
	 */
	private renderEmptyState(message: string): void {
		this.headerEl.empty();
		this.cardContainerEl.empty();
		this.buttonsEl.empty();

		const emptyEl = this.cardContainerEl.createDiv({
			cls: "ep:text-center ep:py-12 ep:px-6",
		});
		emptyEl.createDiv({ cls: "ep:text-5xl ep:mb-4", text: "🎉" });
		emptyEl.createDiv({
			cls: "ep:text-ui-medium ep:text-obs-muted ep:mb-6",
			text: message,
		});

		const closeBtn = emptyEl.createEl("button", {
			cls: "ep:flex ep:flex-col ep:items-center ep:gap-1 ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small mod-cta",
			text: "Close",
		});
		closeBtn.addEventListener("click", () => this.handleClose());
	}

	/**
	 * Render session summary
	 */
	private renderSummary(): void {
		this.headerEl.empty();
		this.cardContainerEl.empty();
		this.buttonsEl.empty();

		const stats = this.stateManager.getStats();

		const summaryEl = this.cardContainerEl.createDiv({
			cls: "ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto",
		});
		summaryEl.createEl("h2", {
			text: "Session Complete!",
			cls: "ep:text-2xl ep:m-0 ep:mb-6 ep:text-obs-normal",
		});

		const statsEl = summaryEl.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-3 ep:mb-6",
		});

		this.renderStatItem(
			statsEl,
			"Total reviewed",
			stats.reviewed.toString()
		);
		this.renderStatItem(
			statsEl,
			"Again",
			stats.again.toString(),
			"ep:text-red-500"
		);
		this.renderStatItem(
			statsEl,
			"Hard",
			stats.hard.toString(),
			"ep:text-orange-500"
		);
		this.renderStatItem(
			statsEl,
			"Good",
			stats.good.toString(),
			"ep:text-green-500"
		);
		this.renderStatItem(
			statsEl,
			"Easy",
			stats.easy.toString(),
			"ep:text-cyan-500"
		);

		const durationMin = Math.floor(stats.duration / 60000);
		const durationSec = Math.floor((stats.duration % 60000) / 1000);
		this.renderStatItem(
			statsEl,
			"Duration",
			`${durationMin}m ${durationSec}s`
		);

		const buttonsEl = summaryEl.createDiv({
			cls: "ep:flex ep:gap-3 ep:py-4ep:justify-center",
		});

		// Shared button classes for summary
		const summaryBtnCls =
			"ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";

		// Show "Next Session" button for custom sessions when setting is enabled
		if (
			this.isCustomSession &&
			this.plugin.settings.continuousCustomReviews
		) {
			const nextSessionBtn = buttonsEl.createEl("button", {
				cls: `${summaryBtnCls} mod-cta`,
				text: "Next session",
			});
			nextSessionBtn.addEventListener("click", () =>
				this.handleNextSession()
			);

			const finishBtn = buttonsEl.createEl("button", {
				cls: `${summaryBtnCls} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`,
				text: "Finish",
			});
			finishBtn.addEventListener("click", () => this.handleClose());
		} else {
			// Standard close button for normal sessions or when continuous mode is disabled
			const closeBtn = buttonsEl.createEl("button", {
				cls: `${summaryBtnCls} mod-cta`,
				text: "Close",
			});
			closeBtn.addEventListener("click", () => this.handleClose());
		}
	}

	/**
	 * Render a stat item
	 */
	private renderStatItem(
		container: HTMLElement,
		label: string,
		value: string,
		valueColorCls?: string
	): void {
		const itemEl = container.createDiv({
			cls: "ep:p-3 ep:bg-obs-secondary ep:rounded-lg",
		});
		itemEl.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1",
			text: label,
		});
		itemEl.createDiv({
			cls: `ep:text-xl ep:font-semibold ep:text-obs-normal ${
				valueColorCls ?? ""
			}`,
			text: value,
		});
	}

	/**
	 * Render waiting screen for learning cards (Anki-like behavior)
	 */
	private renderWaitingScreen(): void {
		this.clearWaitingTimer();
		this.headerEl.empty();
		this.cardContainerEl.empty();
		this.buttonsEl.empty();

		const timeUntilDue = this.stateManager.getTimeUntilNextDue();
		const pendingCards = this.stateManager.getPendingLearningCards();

		const waitingEl = this.cardContainerEl.createDiv({
			cls: "ep:text-center ep:py-8 ep:px-6 ep:max-w-md ep:mx-auto",
		});
		waitingEl.createEl("h2", {
			text: "Congratulations!",
			cls: "ep:text-2xl ep:m-0 ep:mb-4 ep:text-obs-normal",
		});
		waitingEl.createEl("p", {
			text: "You've reviewed all available cards.",
			cls: "ep:text-obs-muted ep:m-0 ep:mb-6",
		});

		// Countdown display
		const countdownContainer = waitingEl.createDiv({ cls: "ep:mb-6" });
		countdownContainer.createEl("p", {
			text: `${pendingCards.length} learning card${
				pendingCards.length === 1 ? "" : "s"
			} due in:`,
			cls: "ep:text-obs-muted ep:text-ui-small ep:m-0 ep:mb-2",
		});
		const countdownEl = countdownContainer.createDiv({
			cls: "ep:text-5xl ep:font-bold ep:text-obs-interactive ep:tabular-nums",
			text: this.formatCountdown(timeUntilDue),
		});

		// Buttons
		const waitingBtnCls =
			"ep:py-3 ep:px-8 ep:border-none ep:rounded-lg ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-transform ep:hover:brightness-110 ep:active:scale-98";
		const buttonsContainerEl = waitingEl.createDiv({
			cls: "ep:flex ep:gap-3 ep:justify-center",
		});

		const waitBtn = buttonsContainerEl.createEl("button", {
			cls: `${waitingBtnCls} mod-cta`,
			text: "Wait",
		});
		waitBtn.addEventListener("click", () => {
			// Just keep waiting, timer will auto-refresh
		});

		const endBtn = buttonsContainerEl.createEl("button", {
			cls: `${waitingBtnCls} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`,
			text: "End session",
		});
		endBtn.addEventListener("click", () => {
			this.clearWaitingTimer();
			this.stateManager.endSession();
			this.renderSummary();
		});

		// Start countdown timer - update every second (only if there's time to wait)
		if (timeUntilDue > 0) {
			this.waitingTimerId = this.subs.setInterval(() => {
				const remaining = this.stateManager.getTimeUntilNextDue();
				if (remaining <= 0) {
					// Card is now due, re-render to show it
					this.clearWaitingTimer();
					this.render();
				} else {
					countdownEl.textContent = this.formatCountdown(remaining);
				}
			}, UI_CONFIG.timerInterval);
		}
	}

	/**
	 * Format milliseconds as MM:SS countdown
	 */
	private formatCountdown(ms: number): string {
		if (ms <= 0) return "0:00";
		const totalSeconds = Math.ceil(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	/**
	 * Emit event to notify FlashcardPanelView of card change
	 */
	private emitCardChangedEvent(): void {
		const card = this.stateManager.getCurrentCard();
		const isActive = this.stateManager.isActive();

		getEventBus().emit({
			type: "review:card-changed",
			sourceNoteName: card?.sourceNoteName ?? null,
			sourceNotePath: card?.sourceNotePath ?? null,
			sourceUid: card?.sourceUid ?? null,
			isActive,
			timestamp: Date.now(),
		} as ReviewCardChangedEvent);
	}

	/**
	 * Update scheduling preview for current card
	 */
	private updateSchedulingPreview(): void {
		// Always update FSRS with latest settings (in case user changed them)
		const fsrsSettings = extractFSRSSettings(this.plugin.settings);
		this.fsrsService.updateSettings(fsrsSettings);

		const card = this.stateManager.getCurrentCard();
		if (card) {
			const preview = this.fsrsService.getSchedulingPreview(card.fsrs);
			this.stateManager.setSchedulingPreview(preview);
		}
	}

	// ===== Event Handlers =====

	private handleShowAnswer(): void {
		this.stateManager.revealAnswer();
		this.updateSchedulingPreview();
	}

	/**
	 * Handle font zoom (Cmd+/Cmd-)
	 * @param delta - Amount to change (positive = zoom in, negative = zoom out)
	 */
	private handleZoom(delta: number): void {
		const current = this.plugin.settings.reviewFontScale;
		const newScale = Math.max(0.5, Math.min(2.0, current + delta));
		if (newScale !== current) {
			this.plugin.settings.reviewFontScale = newScale;
			void this.plugin.saveSettings();
			this.applyFontScale();
		}
	}

	/**
	 * Apply current font scale to Q&A content
	 */
	private applyFontScale(): void {
		const scale = this.plugin.settings.reviewFontScale;
		this.cardContainerEl.style.setProperty("--review-font-scale", String(scale));
	}

	private async handleAnswer(rating: Grade): Promise<void> {
		const card = this.stateManager.getCurrentCard();
		if (!card) return;

		const currentIndex = this.stateManager.getState().currentIndex;
		const responseTime =
			Date.now() - this.stateManager.getState().questionShownTime;

		// Capture state before any changes
		const isNewCard = card.fsrs.state === State.New;
		const previousState = card.fsrs.state;

		// === CRITICAL PATH: Only essential operations before render ===

		// 1. Calculate FSRS data (sync, <1ms)
		const { updatedCard, result } = this.reviewService.processAnswer(
			card,
			rating,
			this.fsrsService,
			responseTime
		);

		// 2. Save to database (sync, <1ms - no event emission)
		this.flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);

		// 3. Calculate requeue data BEFORE state update (needs current state)
		let requeueData: { card: FSRSFlashcardItem; position: number } | undefined;
		if (this.reviewService.shouldRequeue(updatedCard)) {
			const relativePosition = this.reviewService.getRequeuePosition(
				this.stateManager
					.getState()
					.queue.slice(this.stateManager.getState().currentIndex + 1),
				updatedCard,
				this.plugin.settings.reviewOrder
			);
			requeueData = {
				card: updatedCard,
				position: this.stateManager.getState().currentIndex + 1 + relativePosition,
			};
		}

		// 4. RENDER IMMEDIATELY - update state and show next card
		const hasMore = this.stateManager.recordAnswerAndNext(rating, updatedCard, requeueData);

		// === NON-BLOCKING: Fire-and-forget operations after render ===
		queueMicrotask(() => {
			// Push undo entry
			this.plugin.undoService?.push({
				id: crypto.randomUUID(),
				actionType: "answer",
				description: `Review (${Rating[rating]})`,
				timestamp: Date.now(),
				payload: {
					type: "answer",
					card: { ...card },
					originalFsrs: { ...card.fsrs },
					previousIndex: currentIndex,
					wasNewCard: isNewCard,
					rating,
					previousState,
					requeuedAtIndex: requeueData?.position,
				},
			});

			// Record to persistent storage
			try {
				this.sessionPersistence.recordReview(
					card.id,
					isNewCard,
					responseTime,
					rating,
					previousState,
					result.scheduledDays,
					result.elapsedDays
				);
			} catch (error) {
				console.error(
					"Error recording review to persistent storage:",
					error
				);
			}

			// Emit card:reviewed event for stats/panel updates
			getEventBus().emit({
				type: "card:reviewed",
				cardId: card.id,
				rating: rating as number,
				newState: updatedCard.fsrs.state,
				timestamp: Date.now(),
			} as CardReviewedEvent);

			// Notify panel of card change
			this.emitCardChangedEvent();

			// Update scheduling preview for next card
			if (hasMore) {
				this.updateSchedulingPreview();
			}
		});
	}

	/**
	 * Handle undo answer callback from global UndoService
	 * Removes review from persistent storage and restores queue state
	 */
	private async handleUndoAnswerFromService(
		payload: import("../../services/undo").AnswerUndoPayload
	): Promise<void> {
		try {
			this.sessionPersistence.removeLastReview(
				payload.card.id,
				payload.wasNewCard ?? false,
				payload.rating,
				payload.previousState
			);
			// undoLastAnswer() handles queue restoration + stats reversion
			// If card was requeued, requeuedAtIndex tells us where to remove the copy
			this.stateManager.undoLastAnswer(
				payload.previousIndex,
				{ ...payload.card, fsrs: payload.originalFsrs },
				payload.requeuedAtIndex
			);
		} catch (error) {
			console.error("Error undoing answer:", error);
		}
	}

	private handleOpenNote(): void {
		const card = this.stateManager.getCurrentCard();
		if (!card) return;

		// All cards are SQL-only - try to open source note
		if (card.sourceNoteName) {
			this.handleOpenSourceNote();
		} else {
			notify().info("This card has no associated source note");
		}
	}

	private handleClose(): void {
		this.leaf.detach();
	}

	/**
	 * Handle "Next Session" button click - opens new session modal
	 */
	private handleNextSession(): void {
		this.leaf.detach();
		void this.plugin.activateProjectsView();
	}
}
