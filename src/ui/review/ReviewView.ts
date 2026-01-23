/**
 * Review View
 * Main view for spaced repetition review sessions
 * Can be displayed in fullscreen (main area) or panel (sidebar)
 */
import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, Platform, Menu, setIcon, TFile, type ViewStateResult } from "obsidian";
import { Rating, State, type Grade } from "ts-fsrs";
import { VIEW_TYPE_REVIEW, UI_CONFIG } from "../../constants";
import { FSRSService, ReviewService, FlashcardManager, SessionPersistenceService, getEventBus, ZettelTemplateService } from "../../services";
import { ReviewStateManager } from "../../state";
import { extractFSRSSettings, type FSRSFlashcardItem } from "../../types";
import type { CardRemovedEvent, CardUpdatedEvent, BulkChangeEvent } from "../../types/events.types";
import { toggleTextareaWrap, insertAtTextareaCursor, setupAutoResize } from "../components";
import type EpistemePlugin from "../../main";
import type { ReviewViewState, UndoEntry } from "./review.types";
import { CardActionsHandler, KeyboardHandler } from "./handlers";

export class ReviewView extends ItemView {
    private plugin: EpistemePlugin;
    private fsrsService: FSRSService;
    private reviewService: ReviewService;
    private flashcardManager: FlashcardManager;
    private stateManager: ReviewStateManager;
    private sessionPersistence: SessionPersistenceService;

    // Project filter (empty = all projects)
    private projectFilters: string[] = [];

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

    // UI Elements
    private headerEl!: HTMLElement;
    private cardContainerEl!: HTMLElement;
    private buttonsEl!: HTMLElement;

    // State subscription
    private unsubscribe: (() => void) | null = null;

    // Event subscriptions for cross-component reactivity
    private eventUnsubscribers: (() => void)[] = [];

    // Timer for waiting screen countdown
    private waitingTimer: ReturnType<typeof setInterval> | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.stateManager = new ReviewStateManager();
        this.reviewService = new ReviewService();
        this.sessionPersistence = plugin.sessionPersistence;

        // Initialize FSRS service with current settings
        const fsrsSettings = extractFSRSSettings(plugin.settings);
        this.fsrsService = new FSRSService(fsrsSettings);

        // Initialize CardActionsHandler
        this.cardActionsHandler = new CardActionsHandler(
            {
                app: this.app,
                stateManager: this.stateManager,
                flashcardManager: this.flashcardManager,
                fsrsService: this.fsrsService,
                reviewService: this.reviewService,
                openRouterService: this.plugin.openRouterService,
                getSqliteStore: () => this.plugin.getSqliteStore(),
                createZettelTemplateService: () => new ZettelTemplateService(this.app),
                settings: {
                    dayStartHour: this.plugin.settings.dayStartHour,
                    zettelFolder: this.plugin.settings.zettelFolder,
                    zettelTemplatePath: this.plugin.settings.zettelTemplatePath,
                    customGeneratePrompt: this.plugin.settings.customGeneratePrompt,
                    openRouterApiKey: this.plugin.settings.openRouterApiKey,
                },
            },
            {
                onUpdateSchedulingPreview: () => this.updateSchedulingPreview(),
                onRender: () => this.render(),
                onUndoAnswer: (entry) => this.handleUndoAnswer(entry),
            }
        );

        // Initialize KeyboardHandler
        this.keyboardHandler = new KeyboardHandler(
            this.stateManager,
            {
                onShowAnswer: () => this.handleShowAnswer(),
                onAnswer: (rating) => this.handleAnswer(rating as Grade),
                onUndo: async () => { await this.cardActionsHandler.handleUndo(); },
                onSuspend: () => this.cardActionsHandler.handleSuspend(),
                onBuryCard: () => this.cardActionsHandler.handleBuryCard(),
                onBuryNote: () => this.cardActionsHandler.handleBuryNote(),
                onMoveCard: () => this.cardActionsHandler.handleMoveCard(),
                onAddCard: () => this.cardActionsHandler.handleAddNewFlashcard(),
                onAIGenerate: () => this.cardActionsHandler.handleAIGenerateFlashcard(),
                onCopyCard: () => this.cardActionsHandler.handleCopyCurrentCard(),
                onEditCard: () => this.cardActionsHandler.handleEditCardModal(),
            }
        );
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
            (viewState?.sourceNoteFilters && viewState.sourceNoteFilters.length > 0) ||
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
        container.addClass("episteme-review");

        // Create UI structure
        this.headerEl = container.createDiv({ cls: "episteme-review-header" });
        this.cardContainerEl = container.createDiv({ cls: "episteme-review-card-container" });
        this.buttonsEl = container.createDiv({ cls: "episteme-review-buttons" });

        // Subscribe to state changes
        this.unsubscribe = this.stateManager.subscribe(() => this.render());

        // Subscribe to EventBus for cross-component reactivity
        this.subscribeToEvents();

        // Register keyboard shortcuts using the KeyboardHandler
        this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
            // Only handle when this view is active
            const activeLeaf = this.app.workspace.activeLeaf;
            if (activeLeaf?.view !== this) return;

            // Skip if modal is open
            if (document.querySelector('.modal-container')) return;

            this.keyboardHandler.handleKeyDown(e);
        });

        // Note: startSession() is called from setState() after filters are applied
    }

    async onClose(): Promise<void> {
        // Flush store to disk before closing
        if (this.plugin.cardStore) {
            await this.plugin.cardStore.flush();
        }

        this.unsubscribe?.();

        // Cleanup EventBus subscriptions
        this.eventUnsubscribers.forEach((unsub) => unsub());
        this.eventUnsubscribers = [];

        this.clearWaitingTimer();
        this.stateManager.reset();
    }

    /**
     * Subscribe to EventBus events for cross-component reactivity
     * Handles card removal during active review sessions
     */
    private subscribeToEvents(): void {
        const eventBus = getEventBus();

        // Handle card removal during active review
        const unsubRemoved = eventBus.on<CardRemovedEvent>("card:removed", (event) => {
            if (!this.stateManager.isActive()) return;

            // Check if removed card is in our queue
            const queue = this.stateManager.getState().queue;
            const cardInQueue = queue.find((c) => c.id === event.cardId);

            if (cardInQueue) {
                // Remove card from queue gracefully
                this.stateManager.removeCardById(event.cardId);

                // If we were showing this card, re-render
                const currentCard = this.stateManager.getCurrentCard();
                if (!currentCard || currentCard.id === event.cardId) {
                    this.render();
                }
            }
        });
        this.eventUnsubscribers.push(unsubRemoved);

        // Handle card content updates during review
        const unsubUpdated = eventBus.on<CardUpdatedEvent>("card:updated", (event) => {
            if (!this.stateManager.isActive()) return;
            if (!event.changes.question && !event.changes.answer) return;

            // If current card was updated externally, re-render
            const currentCard = this.stateManager.getCurrentCard();
            if (currentCard && currentCard.id === event.cardId) {
                this.render();
            }
        });
        this.eventUnsubscribers.push(unsubUpdated);

        // Handle bulk removals (e.g., from diff apply)
        const unsubBulk = eventBus.on<BulkChangeEvent>("cards:bulk-change", (event) => {
            if (!this.stateManager.isActive()) return;
            if (event.action !== "removed") return;

            // Remove any deleted cards from queue
            let needsRerender = false;
            const currentCard = this.stateManager.getCurrentCard();

            for (const cardId of event.cardIds) {
                const queue = this.stateManager.getState().queue;
                if (queue.find((c) => c.id === cardId)) {
                    this.stateManager.removeCardById(cardId);
                    if (currentCard?.id === cardId) {
                        needsRerender = true;
                    }
                }
            }

            if (needsRerender) {
                this.render();
            }
        });
        this.eventUnsubscribers.push(unsubBulk);
    }

    /**
     * Clear the waiting screen timer
     */
    private clearWaitingTimer(): void {
        if (this.waitingTimer) {
            clearInterval(this.waitingTimer);
            this.waitingTimer = null;
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
                this.renderEmptyState("No flashcards found. Generate some flashcards first!");
                return;
            }

            // Filter out suspended and buried cards (unless reviewing buried specifically)
            const now = new Date();
            const activeCards = allCards.filter((c) => {
                // Skip suspended cards always
                if (c.fsrs.suspended) return false;

                // If reviewing buried cards, ONLY include buried
                if (this.stateFilter === "buried") {
                    if (!c.fsrs.buriedUntil) return false;
                    return new Date(c.fsrs.buriedUntil) > now;
                }

                // Normal mode: exclude buried cards
                if (c.fsrs.buriedUntil) {
                    const buriedUntil = new Date(c.fsrs.buriedUntil);
                    if (buriedUntil > now) return false;
                }

                return true;
            });

            if (activeCards.length === 0) {
                if (this.stateFilter === "buried") {
                    this.renderEmptyState("No buried cards found.");
                } else {
                    this.renderEmptyState("All cards are suspended or buried. Unsuspend/unbury some cards to start reviewing.");
                }
                return;
            }

            // Get persistent stats for today
            const reviewedToday = await this.sessionPersistence.getReviewedToday();
            const newCardsStudiedToday = await this.sessionPersistence.getNewCardsStudiedToday();

            // Build review queue with persistent stats, project filters, custom session filters, and display order settings
            const queue = this.reviewService.buildQueue(activeCards, this.fsrsService, {
                newCardsLimit: this.plugin.settings.newCardsPerDay,
                reviewsLimit: this.plugin.settings.reviewsPerDay,
                reviewedToday,
                newCardsStudiedToday,
                projectFilters: this.projectFilters,
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
            });

            if (queue.length === 0) {
                this.renderEmptyState("Congratulations! No cards due for review.");
                return;
            }

            // Start session
            this.stateManager.startSession(queue);

            // Calculate scheduling preview for first card
            this.updateSchedulingPreview();
        } catch (error) {
            console.error("Error starting review session:", error);
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Render the current state
     */
    private render(): void {
        const state = this.stateManager.getState();

        if (!state.isActive) {
            if (state.stats.reviewed > 0) {
                this.renderSummary();
            }
            return;
        }

        // Check if session is complete
        if (this.stateManager.isComplete()) {
            this.stateManager.endSession();
            this.renderSummary();
            return;
        }

        // Check if waiting for learning cards (Anki-like behavior)
        if (this.stateManager.isWaitingForLearningCards()) {
            this.renderWaitingScreen();
            return;
        }

        // Clear waiting timer if we're showing a card
        this.clearWaitingTimer();

        if (this.plugin.settings.showReviewHeader) {
            this.headerEl.style.display = "";
            this.renderHeader();
        } else {
            this.headerEl.style.display = "none";
            this.headerEl.empty();
        }
        this.renderCard();
        this.renderButtons();
    }

    /**
     * Render header with stats and open note button
     */
    private renderHeader(): void {
        this.headerEl.empty();

        // Stats badges (centered)
        if (this.plugin.settings.showReviewHeaderStats) {
            const remaining = this.calculateRemainingByType();
            const statsContainer = this.headerEl.createDiv({
                cls: "episteme-review-header-stats",
            });
            this.renderHeaderStatBadge(statsContainer, "new", remaining.new);
            this.renderHeaderStatBadge(statsContainer, "learning", remaining.learning);
            this.renderHeaderStatBadge(statsContainer, "due", remaining.due);
        }

        // Add flashcard button (right side, left of open note button)
        const addBtn = this.headerEl.createEl("button", {
            cls: "episteme-btn-add clickable-icon",
            attr: { "aria-label": "Add new flashcard (N)" }
        });
        addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        addBtn.addEventListener("click", () => void this.cardActionsHandler.handleAddNewFlashcard());

        // AI Generate flashcard button (sparkles icon)
        const aiGenBtn = this.headerEl.createEl("button", {
            cls: "episteme-btn-ai-gen clickable-icon",
            attr: { "aria-label": "Generate flashcard with AI (G)" }
        });
        aiGenBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>`;
        aiGenBtn.addEventListener("click", () => void this.cardActionsHandler.handleAIGenerateFlashcard());

        // Open note button (right side)
        const openNoteBtn = this.headerEl.createEl("button", {
            cls: "episteme-review-open-note clickable-icon",
            attr: { "aria-label": "Open note" },
        });
        openNoteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        openNoteBtn.addEventListener("click", () => this.handleOpenNote());
    }

    /**
     * Calculate remaining cards by type in the current queue
     */
    private calculateRemainingByType(): { new: number; learning: number; due: number } {
        const state = this.stateManager.getState();
        const remaining = state.queue.slice(state.currentIndex);

        return {
            new: remaining.filter((c) => c.fsrs.state === State.New).length,
            learning: remaining.filter(
                (c) => c.fsrs.state === State.Learning || c.fsrs.state === State.Relearning
            ).length,
            due: remaining.filter((c) => c.fsrs.state === State.Review).length,
        };
    }

    /**
     * Render a single stat badge in the header
     */
    private renderHeaderStatBadge(
        container: HTMLElement,
        type: "new" | "learning" | "due",
        count: number
    ): void {
        const badge = container.createDiv({
            cls: `episteme-review-stat-badge episteme-review-stat-badge--${type}`,
        });
        badge.createSpan({ text: String(count) });
    }

    /**
     * Render the current flashcard
     */
    private renderCard(): void {
        this.cardContainerEl.empty();

        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        const editState = this.stateManager.getEditState();

        const cardEl = this.cardContainerEl.createDiv({ cls: "episteme-review-card" });

        // Use sourceNotePath as fallback for link resolution when filePath is empty
        const sourcePath = card.filePath || card.sourceNotePath || "";

        // Question
        const questionEl = cardEl.createDiv({ cls: "episteme-review-question" });
        if (editState.active && editState.field === "question") {
            // Edit mode - contenteditable
            this.renderEditableField(questionEl, card.question, "question");
        } else {
            // View mode - markdown
            void MarkdownRenderer.render(
                this.app,
                card.question,
                questionEl,
                sourcePath,
                this
            );
            questionEl.addEventListener("click", (e: MouseEvent) => {
                this.handleFieldClick(e, "question", sourcePath);
            });
            // Long press on mobile to edit
            if (Platform.isMobile) {
                this.addLongPressListener(questionEl, () => this.startEdit("question"));
            }
        }

        // Answer (if revealed)
        if (this.stateManager.isAnswerRevealed()) {
            cardEl.createDiv({ cls: "episteme-review-divider" });

            const answerEl = cardEl.createDiv({ cls: "episteme-review-answer" });
            if (editState.active && editState.field === "answer") {
                // Edit mode - contenteditable
                this.renderEditableField(answerEl, card.answer, "answer");
            } else {
                // View mode - markdown
                void MarkdownRenderer.render(
                    this.app,
                    card.answer,
                    answerEl,
                    sourcePath,
                    this
                );
                answerEl.addEventListener("click", (e: MouseEvent) => {
                    this.handleFieldClick(e, "answer", sourcePath);
                });
                // Long press on mobile to edit
                if (Platform.isMobile) {
                    this.addLongPressListener(answerEl, () => this.startEdit("answer"));
                }
            }

            // Source note backlink
            if (card.sourceNoteName && !editState.active) {
                const backlinkEl = cardEl.createDiv({
                    cls: "episteme-review-backlink"
                });

                // Create clickable link to source note
                const linkEl = backlinkEl.createEl("a", {
                    text: card.sourceNoteName,
                    href: "#",
                    cls: "episteme-review-backlink-link"
                });

                linkEl.addEventListener("click", (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleOpenSourceNote();
                });
            }
        }
    }

    /**
     * Add long press listener for mobile editing
     */
    private addLongPressListener(
        element: HTMLElement,
        callback: () => void,
        duration = UI_CONFIG.longPressDuration
    ): void {
        let timer: number | null = null;

        element.addEventListener("touchstart", () => {
            timer = window.setTimeout(() => {
                callback();
            }, duration);
        });

        element.addEventListener("touchend", () => {
            if (timer) clearTimeout(timer);
        });

        element.addEventListener("touchmove", () => {
            if (timer) clearTimeout(timer);
        });
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
        this.cardContainerEl.addClass("episteme-review-card-container--editing");
        this.renderCard();
        this.renderButtons(); // Hide buttons when entering edit mode (prevents keyboard overlap on mobile)
    }

    /**
     * Render an editable field (textarea + preview)
     */
    private renderEditableField(
        container: HTMLElement,
        content: string,
        field: "question" | "answer"
    ): void {
        const wrapper = container.createDiv({ cls: "episteme-review-edit-wrapper" });

        // Textarea for editing (visible initially)
        const textarea = wrapper.createEl("textarea", {
            cls: "episteme-review-edit-textarea",
            attr: { "data-field": field },
        });
        textarea.value = content.replace(/<br\s*\/?>/gi, "\n");

        // Auto-resize textarea to fit content
        setupAutoResize(textarea);

        // Preview for rendered markdown (hidden initially)
        const preview = wrapper.createDiv({ cls: "episteme-review-edit-preview hidden" });

        // Toolbar under textarea
        this.renderEditToolbar(wrapper, textarea);

        // Events
        textarea.addEventListener("blur", (e) => {
            // Don't blur if clicking toolbar
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (relatedTarget?.closest(".episteme-edit-toolbar")) return;
            void this.saveEditFromTextarea(textarea, field);
        });
        textarea.addEventListener("keydown", (e) => this.handleEditKeydown(e, field));

        // Click preview to edit again
        preview.addEventListener("click", () => {
            preview.addClass("hidden");
            textarea.removeClass("hidden");
            textarea.focus();
        });

        // Auto-focus
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            // Scroll editable field into view (important for mobile with keyboard)
            textarea.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 10);
    }

    /**
     * Handle keydown events in edit mode
     */
    private handleEditKeydown(e: KeyboardEvent, currentField: "question" | "answer"): void {
        const textarea = e.target as HTMLTextAreaElement;

        if (e.key === "Escape") {
            e.preventDefault();
            void this.saveEditFromTextarea(textarea, currentField);
        } else if (e.key === "Tab") {
            e.preventDefault();
            // Switch between question and answer
            const nextField = currentField === "question" ? "answer" : "question";
            // Only switch to answer if it's revealed
            if (nextField === "answer" && !this.stateManager.isAnswerRevealed()) {
                return;
            }
            void (async () => {
                await this.saveEditFromTextarea(textarea, currentField);
                this.startEdit(nextField);
            })();
        }
        // Ctrl+Z, Ctrl+B, Ctrl+I are handled natively by textarea
    }

    /**
     * Render formatting toolbar for edit mode
     */
    private renderEditToolbar(container: HTMLElement, textarea: HTMLTextAreaElement): void {
        const toolbar = container.createDiv({ cls: "episteme-edit-toolbar episteme-edit-toolbar--positioned" });

        const buttons = [
            { label: "**[[]]**", title: "Bold Wiki Link", action: () => toggleTextareaWrap(textarea, "**[[", "]]**") },
            { label: "⏎⏎", title: "Double Line Break", action: () => insertAtTextareaCursor(textarea, "\n\n") },
            { label: "B", title: "Bold", action: () => toggleTextareaWrap(textarea, "**", "**") },
            { label: "I", title: "Italic", action: () => toggleTextareaWrap(textarea, "*", "*") },
            { label: "U", title: "Underline", action: () => toggleTextareaWrap(textarea, "<u>", "</u>") },
            { label: "[[]]", title: "Wiki Link", action: () => toggleTextareaWrap(textarea, "[[", "]]") },
            { label: "$", title: "Math", action: () => toggleTextareaWrap(textarea, "$", "$") },
            { label: "x²", title: "Superscript", action: () => toggleTextareaWrap(textarea, "<sup>", "</sup>") },
            { label: "x₂", title: "Subscript", action: () => toggleTextareaWrap(textarea, "<sub>", "</sub>") },
        ];

        for (const btn of buttons) {
            const btnEl = toolbar.createEl("button", {
                cls: "episteme-edit-toolbar-btn",
                text: btn.label,
                attr: { title: btn.title, tabindex: "-1" },
            });
            btnEl.addEventListener("mousedown", (e) => {
                e.preventDefault(); // Prevent blur on textarea
            });
            btnEl.addEventListener("click", (e) => {
                e.preventDefault();
                btn.action();
                textarea.focus();
            });
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

        // Convert newlines to <br> for storage
        const newContent = textarea.value.replace(/\n/g, "<br>");
        const newQuestion = field === "question" ? newContent : card.question;
        const newAnswer = field === "answer" ? newContent : card.answer;

        // Only save if content actually changed
        const hasChanges =
            (field === "question" && newContent !== editState.originalQuestion) ||
            (field === "answer" && newContent !== editState.originalAnswer);

        if (hasChanges) {
            try {
                // Update card in SQL store
                this.flashcardManager.updateCardContent(card.id, newQuestion, newAnswer);

                // Update card in state
                this.stateManager.updateCurrentCardContent(newQuestion, newAnswer);

                new Notice("Card updated");
            } catch (error) {
                console.error("Error saving card content:", error);
                new Notice("Failed to save card");
            }
        }

        // Exit edit mode
        this.stateManager.cancelEdit();
        this.cardContainerEl.removeClass("episteme-review-card-container--editing");
        this.renderCard();
        this.renderButtons(); // Restore buttons after exiting edit mode
    }

    /**
     * Render answer buttons
     */
    private renderButtons(): void {
        this.buttonsEl.empty();

        // Hide buttons when in edit mode (prevents keyboard from pushing buttons up on mobile)
        if (this.stateManager.getEditState().active) {
            this.buttonsEl.style.display = "none";
            return;
        }
        this.buttonsEl.style.display = "";

        // Create wrapper for buttons layout
        const buttonsWrapper = this.buttonsEl.createDiv({ cls: "episteme-buttons-wrapper" });

        // Main buttons container (left/center)
        const mainButtonsEl = buttonsWrapper.createDiv({ cls: "episteme-buttons-main" });

        if (!this.stateManager.isAnswerRevealed()) {
            // Show answer button
            const showBtn = mainButtonsEl.createEl("button", {
                cls: "episteme-btn episteme-btn-show",
                text: "Show answer",
            });
            showBtn.addEventListener("click", () => this.handleShowAnswer());
        } else {
            // Rating buttons
            const preview = this.stateManager.getSchedulingPreview();
            this.renderRatingButton(mainButtonsEl, "Again", Rating.Again, "episteme-btn-again", preview?.again.interval);
            this.renderRatingButton(mainButtonsEl, "Hard", Rating.Hard, "episteme-btn-hard", preview?.hard.interval);
            this.renderRatingButton(mainButtonsEl, "Good", Rating.Good, "episteme-btn-good", preview?.good.interval);
            this.renderRatingButton(mainButtonsEl, "Easy", Rating.Easy, "episteme-btn-easy", preview?.easy.interval);
        }

        // Actions menu button (always visible)
        const menuBtn = buttonsWrapper.createEl("button", {
            cls: "episteme-btn-menu",
            attr: { "aria-label": "Card actions" }
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
                .setTitle("Create zettel")
                .setIcon("file-plus")
                .onClick(() => this.cardActionsHandler.handleCreateZettel())
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
                .onClick(() => void this.cardActionsHandler.handleEditCardModal())
        );

        menu.addItem((item) =>
            item
                .setTitle("Add New Flashcard")
                .setIcon("plus")
                .onClick(() => void this.cardActionsHandler.handleAddNewFlashcard())
        );

        menu.addItem((item) =>
            item
                .setTitle("Generate with AI (G)")
                .setIcon("sparkles")
                .onClick(() => void this.cardActionsHandler.handleAIGenerateFlashcard())
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
            new Notice("Source note not found");
            return;
        }

        // Find the source note file by name
        const files = this.app.vault.getMarkdownFiles();
        const sourceFile = files.find(f => f.basename === card.sourceNoteName);

        if (sourceFile) {
            void this.app.workspace.openLinkText(sourceFile.path, "", false);
        } else {
            new Notice(`Source note "${card.sourceNoteName}" not found`);
        }
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
        const btn = container.createEl("button", { cls: `episteme-btn ${cls}` });

        btn.createDiv({ cls: "episteme-btn-label", text: label });

        if (interval && this.plugin.settings.showNextReviewTime) {
            btn.createDiv({ cls: "episteme-btn-time", text: interval });
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

        const emptyEl = this.cardContainerEl.createDiv({ cls: "episteme-review-empty" });
        emptyEl.createDiv({ cls: "episteme-review-empty-icon", text: "🎉" });
        emptyEl.createDiv({ cls: "episteme-review-empty-text", text: message });

        const closeBtn = emptyEl.createEl("button", {
            cls: "episteme-btn episteme-btn-primary",
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

        const summaryEl = this.cardContainerEl.createDiv({ cls: "episteme-review-summary" });
        summaryEl.createEl("h2", { text: "Session Complete!" });

        const statsEl = summaryEl.createDiv({ cls: "episteme-review-stats" });

        this.renderStatItem(statsEl, "Total reviewed", stats.reviewed.toString());
        this.renderStatItem(statsEl, "Again", stats.again.toString(), "stat-again");
        this.renderStatItem(statsEl, "Hard", stats.hard.toString(), "stat-hard");
        this.renderStatItem(statsEl, "Good", stats.good.toString(), "stat-good");
        this.renderStatItem(statsEl, "Easy", stats.easy.toString(), "stat-easy");

        const durationMin = Math.floor(stats.duration / 60000);
        const durationSec = Math.floor((stats.duration % 60000) / 1000);
        this.renderStatItem(statsEl, "Duration", `${durationMin}m ${durationSec}s`);

        const buttonsEl = summaryEl.createDiv({ cls: "episteme-review-summary-buttons" });

        // Show "Next Session" button for custom sessions when setting is enabled
        if (this.isCustomSession && this.plugin.settings.continuousCustomReviews) {
            const nextSessionBtn = buttonsEl.createEl("button", {
                cls: "episteme-btn episteme-btn-primary",
                text: "Next session",
            });
            nextSessionBtn.addEventListener("click", () => this.handleNextSession());

            const finishBtn = buttonsEl.createEl("button", {
                cls: "episteme-btn episteme-btn-secondary",
                text: "Finish",
            });
            finishBtn.addEventListener("click", () => this.handleClose());
        } else {
            // Standard close button for normal sessions or when continuous mode is disabled
            const closeBtn = buttonsEl.createEl("button", {
                cls: "episteme-btn episteme-btn-primary",
                text: "Close",
            });
            closeBtn.addEventListener("click", () => this.handleClose());
        }
    }

    /**
     * Render a stat item
     */
    private renderStatItem(container: HTMLElement, label: string, value: string, cls?: string): void {
        const itemEl = container.createDiv({ cls: `episteme-stat-item ${cls ?? ""}` });
        itemEl.createDiv({ cls: "episteme-stat-label", text: label });
        itemEl.createDiv({ cls: "episteme-stat-value", text: value });
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

        const waitingEl = this.cardContainerEl.createDiv({ cls: "episteme-review-waiting" });
        waitingEl.createEl("h2", { text: "Congratulations!" });
        waitingEl.createEl("p", {
            text: "You've reviewed all available cards.",
            cls: "episteme-waiting-message"
        });

        // Countdown display
        const countdownContainer = waitingEl.createDiv({ cls: "episteme-waiting-countdown" });
        countdownContainer.createEl("p", {
            text: `${pendingCards.length} learning card${pendingCards.length === 1 ? '' : 's'} due in:`,
            cls: "episteme-waiting-label"
        });
        const countdownEl = countdownContainer.createDiv({
            cls: "episteme-countdown-timer",
            text: this.formatCountdown(timeUntilDue)
        });

        // Buttons
        const buttonsEl = waitingEl.createDiv({ cls: "episteme-review-waiting-buttons" });

        const waitBtn = buttonsEl.createEl("button", {
            cls: "episteme-btn episteme-btn-primary",
            text: "Wait",
        });
        waitBtn.addEventListener("click", () => {
            // Just keep waiting, timer will auto-refresh
        });

        const endBtn = buttonsEl.createEl("button", {
            cls: "episteme-btn episteme-btn-secondary",
            text: "End session",
        });
        endBtn.addEventListener("click", () => {
            this.clearWaitingTimer();
            this.stateManager.endSession();
            this.renderSummary();
        });

        // Start countdown timer - update every second (only if there's time to wait)
        if (timeUntilDue > 0) {
            this.waitingTimer = setInterval(() => {
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
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

    private async handleAnswer(rating: Grade): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        const currentIndex = this.stateManager.getState().currentIndex;
        const responseTime = Date.now() - this.stateManager.getState().questionShownTime;

        // Check if this was a new card (before state update)
        const isNewCard = card.fsrs.state === State.New;

        // Store undo entry in handler's stack BEFORE making changes
        this.cardActionsHandler.pushUndoEntry({
            actionType: "answer",
            card: { ...card },
            originalFsrs: { ...card.fsrs },
            wasNewCard: isNewCard,
            previousIndex: currentIndex,
            rating,
            previousState: card.fsrs.state,
        });

        // Process answer and save to store (single method)
        const { updatedCard, result } = await this.reviewService.gradeCard(
            card,
            rating,
            this.fsrsService,
            this.flashcardManager,
            responseTime
        );

        // Record to persistent storage (with extended stats for statistics panel)
        try {
            this.sessionPersistence.recordReview(
                card.id,
                isNewCard,
                responseTime,
                rating,
                card.fsrs.state, // previousState before the answer
                result.scheduledDays,
                result.elapsedDays
            );
        } catch (error) {
            console.error("Error recording review to persistent storage:", error);
        }

        // Record the answer
        this.stateManager.recordAnswer(rating, updatedCard);

        // Check if card needs to be requeued (for learning cards)
        if (this.reviewService.shouldRequeue(updatedCard)) {
            const position = this.reviewService.getRequeuePosition(
                this.stateManager.getState().queue.slice(this.stateManager.getState().currentIndex + 1),
                updatedCard,
                this.plugin.settings.reviewOrder
            );
            this.stateManager.requeueCard(updatedCard, this.stateManager.getState().currentIndex + 1 + position);
        }

        // Move to next card
        const hasMore = this.stateManager.nextCard();
        if (hasMore) {
            this.updateSchedulingPreview();
        }
    }

    /**
     * Handle undo answer callback from CardActionsHandler
     * Removes review from persistent storage and restores state
     */
    private async handleUndoAnswer(entry: UndoEntry): Promise<void> {
        try {
            await this.sessionPersistence.removeLastReview(
                entry.card.id,
                entry.wasNewCard ?? false,
                entry.rating,
                entry.previousState
            );
            this.stateManager.undoLastAnswer(entry.previousIndex, { ...entry.card, fsrs: entry.originalFsrs });
        } catch (error) {
            console.error("Error undoing answer:", error);
        }
    }

    private handleOpenNote(): void {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        // SQL-only cards have no file - try to open source note instead
        if (card.filePath === "") {
            if (card.sourceNoteName) {
                this.handleOpenSourceNote();
            } else {
                new Notice("This card is stored in SQL only (no associated file)");
            }
            return;
        }

        // Open the flashcard file at the card's position
        const file = this.app.vault.getAbstractFileByPath(card.filePath);
        if (file instanceof TFile) {
            void this.flashcardManager.openFileAtCard(file, card.id);
        }
    }

    private handleClose(): void {
        this.leaf.detach();
    }

    /**
     * Handle "Next Session" button click - opens new session modal
     */
    private handleNextSession(): void {
        void this.plugin.startNewReviewSession();
    }
}
