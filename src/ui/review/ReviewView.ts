/**
 * Review View
 * Main view for spaced repetition review sessions
 * Can be displayed in fullscreen (main area) or panel (sidebar)
 */
import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice, Platform, normalizePath, Menu, setIcon, type ViewStateResult } from "obsidian";
import { Rating, State, type Grade } from "ts-fsrs";
import { VIEW_TYPE_REVIEW } from "../../constants";
import { FSRSService, ReviewService, FlashcardManager, SessionPersistenceService } from "../../services";
import { ReviewStateManager } from "../../state";
import { extractFSRSSettings, type FSRSFlashcardItem, type SchedulingPreview } from "../../types";
import { MoveCardModal } from "../modals";
import type EpistemePlugin from "../../main";

interface ReviewViewState extends Record<string, unknown> {
    deckFilter?: string | null;
    // Custom session filters
    sourceNoteFilter?: string;
    sourceNoteFilters?: string[];
    filePathFilter?: string;
    createdTodayOnly?: boolean;
    createdThisWeek?: boolean;
    weakCardsOnly?: boolean;
    stateFilter?: "due" | "learning" | "new";
    temporaryOnly?: boolean;
    ignoreDailyLimits?: boolean;
}

/**
 * Review View for conducting flashcard review sessions
 */
/**
 * Undo entry for reverting a card answer
 */
interface UndoEntry {
    card: FSRSFlashcardItem;
    originalFsrs: FSRSFlashcardItem["fsrs"];
    wasNewCard: boolean;
    previousIndex: number;
    rating: Grade;
    previousState: State;
}

export class ReviewView extends ItemView {
    private plugin: EpistemePlugin;
    private fsrsService: FSRSService;
    private reviewService: ReviewService;
    private flashcardManager: FlashcardManager;
    private stateManager: ReviewStateManager;
    private sessionPersistence: SessionPersistenceService;

    // Deck filter (null = all decks)
    private deckFilter: string | null = null;

    // Track if this is a custom review session (with filters)
    private isCustomSession: boolean = false;

    // Custom session filters
    private sourceNoteFilter?: string;
    private sourceNoteFilters?: string[];
    private filePathFilter?: string;
    private createdTodayOnly?: boolean;
    private createdThisWeek?: boolean;
    private weakCardsOnly?: boolean;
    private stateFilter?: "due" | "learning" | "new";
    private temporaryOnly?: boolean;
    private ignoreDailyLimits?: boolean;

    // Undo stack for reverting answers
    private undoStack: UndoEntry[] = [];

    // UI Elements
    private headerEl!: HTMLElement;
    private cardContainerEl!: HTMLElement;
    private buttonsEl!: HTMLElement;
    private progressEl!: HTMLElement;

    // State subscription
    private unsubscribe: (() => void) | null = null;

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
    }

    /**
     * Set view state (including deck filter and custom session filters)
     */
    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const viewState = state as ReviewViewState | null;
        this.deckFilter = viewState?.deckFilter ?? null;
        this.sourceNoteFilter = viewState?.sourceNoteFilter;
        this.sourceNoteFilters = viewState?.sourceNoteFilters;
        this.filePathFilter = viewState?.filePathFilter;
        this.createdTodayOnly = viewState?.createdTodayOnly;
        this.createdThisWeek = viewState?.createdThisWeek;
        this.weakCardsOnly = viewState?.weakCardsOnly;
        this.stateFilter = viewState?.stateFilter;
        this.temporaryOnly = viewState?.temporaryOnly;
        this.ignoreDailyLimits = viewState?.ignoreDailyLimits;

        // Detect if this is a custom review session (any custom filter is set)
        this.isCustomSession = !!(
            viewState?.sourceNoteFilter ||
            (viewState?.sourceNoteFilters && viewState.sourceNoteFilters.length > 0) ||
            viewState?.filePathFilter ||
            viewState?.createdTodayOnly ||
            viewState?.createdThisWeek ||
            viewState?.weakCardsOnly ||
            viewState?.stateFilter ||
            viewState?.temporaryOnly ||
            viewState?.readyToHarvestOnly
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
            deckFilter: this.deckFilter,
            sourceNoteFilter: this.sourceNoteFilter,
            sourceNoteFilters: this.sourceNoteFilters,
            filePathFilter: this.filePathFilter,
            createdTodayOnly: this.createdTodayOnly,
            createdThisWeek: this.createdThisWeek,
            weakCardsOnly: this.weakCardsOnly,
            stateFilter: this.stateFilter,
            temporaryOnly: this.temporaryOnly,
            ignoreDailyLimits: this.ignoreDailyLimits,
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

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("episteme-review");

        // Create UI structure
        this.headerEl = container.createDiv({ cls: "episteme-review-header" });
        this.cardContainerEl = container.createDiv({ cls: "episteme-review-card-container" });
        this.buttonsEl = container.createDiv({ cls: "episteme-review-buttons" });
        this.progressEl = container.createDiv({ cls: "episteme-review-progress" });

        // Subscribe to state changes
        this.unsubscribe = this.stateManager.subscribe(() => this.render());

        // Register keyboard shortcuts
        document.addEventListener("keydown", this.handleKeyDown);

        // Note: startSession() is called from setState() after filters are applied
    }

    async onClose(): Promise<void> {
        // Flush store to disk before closing
        if (this.plugin.shardedStore) {
            await this.plugin.shardedStore.flush();
        }

        document.removeEventListener("keydown", this.handleKeyDown);
        this.unsubscribe?.();
        this.clearWaitingTimer();
        this.stateManager.reset();
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
            // Sync with disk to get changes from other devices (iCloud sync)
            if (this.plugin.shardedStore) {
                await this.plugin.shardedStore.mergeFromDisk();
            }

            // Update FSRS service with latest settings
            const fsrsSettings = extractFSRSSettings(this.plugin.settings);
            this.fsrsService.updateSettings(fsrsSettings);

            // Get all cards
            const allCards = await this.flashcardManager.getAllFSRSCards();

            if (allCards.length === 0) {
                this.renderEmptyState("No flashcards found. Generate some flashcards first!");
                return;
            }

            // Filter out suspended cards
            const activeCards = allCards.filter((c) => !c.fsrs.suspended);

            if (activeCards.length === 0) {
                this.renderEmptyState("All cards are suspended. Unsuspend some cards to start reviewing.");
                return;
            }

            // Get persistent stats for today
            const reviewedToday = await this.sessionPersistence.getReviewedToday();
            const newCardsStudiedToday = await this.sessionPersistence.getNewCardsStudiedToday();

            // Build review queue with persistent stats, deck filter, custom session filters, and display order settings
            const queue = this.reviewService.buildQueue(activeCards, this.fsrsService, {
                newCardsLimit: this.plugin.settings.newCardsPerDay,
                reviewsLimit: this.plugin.settings.reviewsPerDay,
                reviewedToday,
                newCardsStudiedToday,
                deckFilter: this.deckFilter,
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
                temporaryOnly: this.temporaryOnly,
                ignoreDailyLimits: this.ignoreDailyLimits,
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
        this.renderProgress();
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

        // Yellow dot indicator for temporary cards (from Literature Notes)
        // Gold/amber dot when ready to harvest (interval >= 21 days), yellow otherwise
        if (card.isTemporary) {
            const isReadyToHarvest = card.fsrs.scheduledDays >= 21;
            const dotEl = cardEl.createDiv({
                cls: `episteme-temporary-dot ${isReadyToHarvest ? "episteme-harvest-dot" : ""}`,
            });
            dotEl.setAttribute("aria-label", isReadyToHarvest ? "Ready to harvest" : "Temporary card");
        }

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
                card.filePath,
                this
            );
            questionEl.addEventListener("click", (e: MouseEvent) => {
                this.handleFieldClick(e, "question", card.filePath);
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
                    card.filePath,
                    this
                );
                answerEl.addEventListener("click", (e: MouseEvent) => {
                    this.handleFieldClick(e, "answer", card.filePath);
                });
                // Long press on mobile to edit
                if (Platform.isMobile) {
                    this.addLongPressListener(answerEl, () => this.startEdit("answer"));
                }
            }
        }
    }

    /**
     * Add long press listener for mobile editing
     */
    private addLongPressListener(
        element: HTMLElement,
        callback: () => void,
        duration = 500
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
        const linkEl = (e.target as HTMLElement).closest("a.internal-link");

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
     * Render an editable field (contenteditable div)
     */
    private renderEditableField(
        container: HTMLElement,
        content: string,
        field: "question" | "answer"
    ): void {
        const editEl = container.createDiv({
            cls: "episteme-review-editable",
            attr: {
                contenteditable: "true",
                "data-field": field,
            },
        });
        editEl.textContent = content;

        // Event listeners
        editEl.addEventListener("blur", () => void this.saveEdit());
        editEl.addEventListener("keydown", (e) => this.handleEditKeydown(e, field));

        // Auto-focus after a small delay to ensure DOM is ready
        setTimeout(() => {
            editEl.focus();
            // Move cursor to end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(editEl);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
            // Scroll editable field into view (important for mobile with keyboard)
            editEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 10);
    }

    /**
     * Handle keydown events in edit mode
     */
    private handleEditKeydown(e: KeyboardEvent, currentField: "question" | "answer"): void {
        if (e.key === "Escape") {
            e.preventDefault();
            void this.saveEdit();
        } else if (e.key === "Tab") {
            e.preventDefault();
            // Switch between question and answer
            const nextField = currentField === "question" ? "answer" : "question";
            // Only switch to answer if it's revealed
            if (nextField === "answer" && !this.stateManager.isAnswerRevealed()) {
                return;
            }
            void this.saveEdit().then(() => {
                this.startEdit(nextField);
            });
        }
        // Ctrl+Z, Ctrl+B, Ctrl+I, Ctrl+U are handled natively by contenteditable
    }

    /**
     * Convert contenteditable HTML to markdown text with <br> for line breaks
     */
    private convertEditableToMarkdown(editEl: HTMLElement): string {
        let html = editEl.innerHTML;

        // Normalize different browser line break representations:
        // - Chrome/Safari: <div>text</div> or <br>
        // - Firefox: <br>
        // - Edge: <p>text</p>

        // Replace <br> tags with newline
        html = html.replace(/<br\s*\/?>/gi, "\n");

        // Replace closing </div> and </p> with newline (opening tags create blocks)
        html = html.replace(/<\/div>/gi, "\n");
        html = html.replace(/<\/p>/gi, "\n");

        // Remove remaining HTML tags
        html = html.replace(/<[^>]*>/g, "");

        // Decode HTML entities
        const textarea = document.createElement("textarea");
        textarea.innerHTML = html;
        const text = textarea.value;

        // Trim trailing newlines but preserve internal ones
        const trimmed = text.replace(/\n+$/, "");

        // Replace remaining newlines with <br>
        return trimmed.replace(/\n/g, "<br>");
    }

    /**
     * Save the current edit to file
     */
    private async saveEdit(): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        const editState = this.stateManager.getEditState();
        if (!card || !editState.active) return;

        const editEl = this.cardContainerEl.querySelector('[contenteditable="true"]') as HTMLElement;
        if (!editEl) return;

        const newContent = this.convertEditableToMarkdown(editEl);
        const newQuestion = editState.field === "question" ? newContent : card.question;
        const newAnswer = editState.field === "answer" ? newContent : card.answer;

        // Only save if content actually changed
        const hasChanges =
            (editState.field === "question" && newContent !== editState.originalQuestion) ||
            (editState.field === "answer" && newContent !== editState.originalAnswer);

        if (hasChanges) {
            try {
                // Save to file
                await this.flashcardManager.updateCardContent(
                    card.filePath,
                    card.lineNumber,
                    newQuestion,
                    newAnswer
                );

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
                text: "Show Answer",
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

        menu.addItem((item) =>
            item
                .setTitle("Move Card (M)")
                .setIcon("folder-input")
                .onClick(() => this.handleMoveCard())
        );

        menu.addItem((item) =>
            item
                .setTitle("Create Zettel")
                .setIcon("file-plus")
                .onClick(() => this.handleCreateZettel())
        );

        menu.addItem((item) =>
            item
                .setTitle("Suspend Card")
                .setIcon("pause")
                .onClick(() => this.handleSuspend())
        );

        menu.addItem((item) =>
            item
                .setTitle("Edit Card")
                .setIcon("pencil")
                .onClick(() => this.enterEditMode())
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
     * Enter edit mode for current card
     */
    private enterEditMode(): void {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        this.stateManager.startEdit("question");
        this.renderCard();
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
     * Render progress bar
     * Note: Use inline style display to properly hide element (more reliable than CSS :empty)
     */
    private renderProgress(): void {
        if (!this.plugin.settings.showProgress) {
            this.progressEl.style.display = "none";
            return;
        }

        this.progressEl.style.display = "";
        this.progressEl.empty();

        const progress = this.stateManager.getProgress();

        const progressBar = this.progressEl.createDiv({ cls: "episteme-progress-bar" });
        const progressFill = progressBar.createDiv({ cls: "episteme-progress-fill" });
        progressFill.style.width = `${progress.percentage}%`;
    }

    /**
     * Render empty state
     */
    private renderEmptyState(message: string): void {
        this.headerEl.empty();
        this.cardContainerEl.empty();
        this.buttonsEl.empty();
        this.progressEl.empty();

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
        this.progressEl.empty();

        const stats = this.stateManager.getStats();

        const summaryEl = this.cardContainerEl.createDiv({ cls: "episteme-review-summary" });
        summaryEl.createEl("h2", { text: "Session Complete!" });

        const statsEl = summaryEl.createDiv({ cls: "episteme-review-stats" });

        this.renderStatItem(statsEl, "Total Reviewed", stats.reviewed.toString());
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
                text: "Next Session",
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
        this.progressEl.empty();

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
            text: "End Session",
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
            }, 1000);
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

    /**
     * Handle keyboard shortcuts for review actions
     */
    private handleKeyDown = (e: KeyboardEvent): void => {
        // Ignore if typing in input/textarea or contenteditable
        if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            (e.target instanceof HTMLElement && e.target.isContentEditable)
        ) {
            return;
        }

        // Cmd+Z (Mac) or Ctrl+Z (Windows/Linux) for undo
        if ((e.metaKey || e.ctrlKey) && e.key === "z") {
            e.preventDefault();
            void this.handleUndo();
            return;
        }

        // Shift+1 = Suspend card
        if (e.shiftKey && e.key === "!") {
            e.preventDefault();
            void this.handleSuspend();
            return;
        }

        // M = Move card to another note
        if (e.key === "m" || e.key === "M") {
            e.preventDefault();
            void this.handleMoveCard();
            return;
        }

        const state = this.stateManager.getState();
        if (!state.isActive || this.stateManager.isComplete()) return;

        if (!this.stateManager.isAnswerRevealed()) {
            // Show answer on Space
            if (e.code === "Space") {
                e.preventDefault();
                this.handleShowAnswer();
            }
        } else {
            // Rating buttons: 1=Again, 2=Hard, 3=Good, 4=Easy
            switch (e.key) {
                case "1":
                    e.preventDefault();
                    void this.handleAnswer(Rating.Again);
                    break;
                case "2":
                    e.preventDefault();
                    void this.handleAnswer(Rating.Hard);
                    break;
                case "3":
                case " ": // Space bar also triggers Good
                    e.preventDefault();
                    void this.handleAnswer(Rating.Good);
                    break;
                case "4":
                    e.preventDefault();
                    void this.handleAnswer(Rating.Easy);
                    break;
            }
        }
    };

    private handleShowAnswer(): void {
        this.stateManager.revealAnswer();
        this.updateSchedulingPreview();
    }

    private async handleCreateZettel(): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        const zettelFolder = this.plugin.settings.zettelFolder;
        const folderPath = normalizePath(zettelFolder);

        // Ensure folder exists
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            await this.app.vault.createFolder(folderPath);
        }

        // Find unique filename (Untitled, Untitled 1, Untitled 2, ...)
        let filePath = normalizePath(`${folderPath}/Untitled.md`);
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(filePath)) {
            filePath = normalizePath(`${folderPath}/Untitled ${counter}.md`);
            counter++;
        }

        // Build content
        const sourceNote = card.sourceNoteName || "Unknown";
        const content = `${card.question}

${card.answer}

---
Source: [[${sourceNote}]]
`;

        // Create file and open it
        await this.app.vault.create(filePath, content);
        await this.app.workspace.openLinkText(filePath, "", true);
    }

    private async handleAnswer(rating: Grade): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        const currentIndex = this.stateManager.getState().currentIndex;
        const responseTime = Date.now() - this.stateManager.getState().questionShownTime;

        // Check if this was a new card (before state update)
        const isNewCard = card.fsrs.state === State.New;

        // Store undo entry BEFORE making changes
        this.undoStack.push({
            card: { ...card },
            originalFsrs: { ...card.fsrs },
            wasNewCard: isNewCard,
            previousIndex: currentIndex,
            rating,
            previousState: card.fsrs.state,
        });

        // Process answer and save to store (single method)
        const { updatedCard } = await this.reviewService.gradeCard(
            card,
            rating,
            this.fsrsService,
            this.flashcardManager,
            responseTime
        );

        // Record to persistent storage (with extended stats for statistics panel)
        try {
            await this.sessionPersistence.recordReview(
                card.id,
                isNewCard,
                responseTime,
                rating,
                card.fsrs.state // previousState before the answer
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
                updatedCard
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
     * Undo the last answer (Cmd+Z)
     */
    private async handleUndo(): Promise<void> {
        const undoEntry = this.undoStack.pop();
        if (!undoEntry) {
            return; // Nothing to undo
        }

        const { card, originalFsrs, wasNewCard, previousIndex, rating, previousState } = undoEntry;

        // Restore original FSRS data to file
        try {
            await this.flashcardManager.updateCardFSRS(
                card.filePath,
                card.id,
                originalFsrs,
                card.lineNumber
            );
        } catch (error) {
            console.error("Error restoring card FSRS:", error);
        }

        // Remove from persistent storage (with full stats revert)
        try {
            await this.sessionPersistence.removeLastReview(card.id, wasNewCard, rating, previousState);
        } catch (error) {
            console.error("Error removing review from persistent storage:", error);
        }

        // Restore state - go back to previous card
        this.stateManager.undoLastAnswer(previousIndex, { ...card, fsrs: originalFsrs });

        // Update UI
        this.updateSchedulingPreview();
    }

    /**
     * Move the current card to another note (M key)
     * Also grades the card as "Good" before moving
     */
    private async handleMoveCard(): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        // Open move modal with card content for backlink suggestions
        const modal = new MoveCardModal(this.app, {
            cardCount: 1,
            sourceNoteName: card.sourceNoteName,
            flashcardsFolder: this.plugin.settings.flashcardsFolder,
            cardQuestion: card.question,
            cardAnswer: card.answer,
        });

        const result = await modal.openAndWait();
        if (result.cancelled || !result.targetNotePath) return;

        try {
            // Grade card as "Good" before moving (updates FSRS scheduling)
            await this.reviewService.gradeCard(
                card,
                Rating.Good,
                this.fsrsService,
                this.flashcardManager
            );

            // Move the card
            const success = await this.flashcardManager.moveCard(
                card.id,
                card.filePath,
                result.targetNotePath
            );

            if (success) {
                // Remove from current queue (card no longer exists in original file)
                this.stateManager.removeCurrentCard();

                // Update scheduling preview for next card
                if (!this.stateManager.isComplete()) {
                    this.updateSchedulingPreview();
                }

                new Notice("Card graded as Good and moved");
            }
        } catch (error) {
            console.error("Error moving card:", error);
            new Notice(`Failed to move card: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Suspend the current card (Shift+1)
     * Card will be excluded from future reviews until unsuspended
     */
    private async handleSuspend(): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        // Mark card as suspended
        const updatedFsrs = { ...card.fsrs, suspended: true };

        try {
            await this.flashcardManager.updateCardFSRS(
                card.filePath,
                card.id,
                updatedFsrs,
                card.lineNumber
            );
        } catch (error) {
            console.error("Error suspending card:", error);
            new Notice("Failed to suspend card");
            return;
        }

        // Remove from current queue
        this.stateManager.removeCurrentCard();

        // Update scheduling preview for next card
        if (!this.stateManager.isComplete()) {
            this.updateSchedulingPreview();
        }

        new Notice("Card suspended");
    }

    private handleOpenNote(): void {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        // Open the flashcard file at the card's line
        void this.flashcardManager.openFileAtLine(
            this.app.vault.getAbstractFileByPath(card.filePath) as any,
            card.lineNumber
        );
    }

    private handleClose(): void {
        this.leaf.detach();
    }

    /**
     * Handle "Next Session" button click - opens new custom session modal
     */
    private handleNextSession(): void {
        this.leaf.detach();

        // Wait for view to close, then open new custom session
        setTimeout(() => {
            void this.plugin.startCustomReviewSession();
        }, 100);
    }
}
