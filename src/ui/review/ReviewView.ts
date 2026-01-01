/**
 * Review View
 * Main view for spaced repetition review sessions
 * Can be displayed in fullscreen (main area) or panel (sidebar)
 */
import { ItemView, WorkspaceLeaf, MarkdownRenderer, Notice } from "obsidian";
import { Rating, State, type Grade } from "ts-fsrs";
import { VIEW_TYPE_REVIEW } from "../../constants";
import { FSRSService, ReviewService, FlashcardManager } from "../../services";
import { ReviewStateManager } from "../../state";
import { extractFSRSSettings, type FSRSFlashcardItem, type SchedulingPreview } from "../../types";
import type ShadowAnkiPlugin from "../../main";

/**
 * Review View for conducting flashcard review sessions
 */
export class ReviewView extends ItemView {
    private plugin: ShadowAnkiPlugin;
    private fsrsService: FSRSService;
    private reviewService: ReviewService;
    private flashcardManager: FlashcardManager;
    private stateManager: ReviewStateManager;

    // UI Elements
    private headerEl!: HTMLElement;
    private cardContainerEl!: HTMLElement;
    private buttonsEl!: HTMLElement;
    private progressEl!: HTMLElement;

    // State subscription
    private unsubscribe: (() => void) | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ShadowAnkiPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.stateManager = new ReviewStateManager();
        this.reviewService = new ReviewService();

        // Initialize FSRS service with current settings
        const fsrsSettings = extractFSRSSettings(plugin.settings);
        this.fsrsService = new FSRSService(fsrsSettings);
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
        container.addClass("shadow-anki-review");

        // Create UI structure
        this.headerEl = container.createDiv({ cls: "shadow-anki-review-header" });
        this.cardContainerEl = container.createDiv({ cls: "shadow-anki-review-card-container" });
        this.buttonsEl = container.createDiv({ cls: "shadow-anki-review-buttons" });
        this.progressEl = container.createDiv({ cls: "shadow-anki-review-progress" });

        // Subscribe to state changes
        this.unsubscribe = this.stateManager.subscribe(() => this.render());

        // Register keyboard shortcuts
        document.addEventListener("keydown", this.handleKeyDown);

        // Start session automatically
        await this.startSession();
    }

    async onClose(): Promise<void> {
        document.removeEventListener("keydown", this.handleKeyDown);
        this.unsubscribe?.();
        this.stateManager.reset();
    }

    /**
     * Start a new review session
     */
    async startSession(): Promise<void> {
        try {
            // Get all cards
            const allCards = await this.flashcardManager.getAllFSRSCards();

            if (allCards.length === 0) {
                this.renderEmptyState("No flashcards found. Generate some flashcards first!");
                return;
            }

            // Build review queue
            const queue = this.reviewService.buildQueue(allCards, this.fsrsService, {
                newCardsLimit: this.plugin.settings.newCardsPerDay,
                reviewsLimit: this.plugin.settings.reviewsPerDay,
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
     * Render header with close button and progress
     */
    private renderHeader(): void {
        this.headerEl.empty();

        const progress = this.stateManager.getProgress();

        // Close button
        const closeBtn = this.headerEl.createEl("button", {
            cls: "shadow-anki-review-close clickable-icon",
            attr: { "aria-label": "Close review" },
        });
        closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeBtn.addEventListener("click", () => this.handleClose());

        // Stats badges (if enabled)
        if (this.plugin.settings.showReviewHeaderStats) {
            const remaining = this.calculateRemainingByType();
            const statsContainer = this.headerEl.createDiv({
                cls: "shadow-anki-review-header-stats",
            });
            this.renderHeaderStatBadge(statsContainer, "new", remaining.new);
            this.renderHeaderStatBadge(statsContainer, "learning", remaining.learning);
            this.renderHeaderStatBadge(statsContainer, "due", remaining.due);
        }

        // Progress text
        this.headerEl.createDiv({
            cls: "shadow-anki-review-progress-text",
            text: `${progress.current} / ${progress.total}`,
        });

        // Edit button (placeholder for now)
        const editBtn = this.headerEl.createEl("button", {
            cls: "shadow-anki-review-edit clickable-icon",
            attr: { "aria-label": "Edit card" },
        });
        editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        editBtn.addEventListener("click", () => this.handleEdit());
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
            cls: `shadow-anki-review-stat-badge shadow-anki-review-stat-badge--${type}`,
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
        const cardEl = this.cardContainerEl.createDiv({ cls: "shadow-anki-review-card" });

        // Question
        const questionEl = cardEl.createDiv({ cls: "shadow-anki-review-question" });
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
        }

        // Answer (if revealed)
        if (this.stateManager.isAnswerRevealed()) {
            cardEl.createDiv({ cls: "shadow-anki-review-divider" });

            const answerEl = cardEl.createDiv({ cls: "shadow-anki-review-answer" });
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
        this.renderCard();
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
            cls: "shadow-anki-review-editable",
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
     * Save the current edit to file
     */
    private async saveEdit(): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        const editState = this.stateManager.getEditState();
        if (!card || !editState.active) return;

        const editEl = this.cardContainerEl.querySelector('[contenteditable="true"]') as HTMLElement;
        if (!editEl) return;

        const newContent = editEl.textContent ?? "";
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
        this.renderCard();
    }

    /**
     * Render answer buttons
     */
    private renderButtons(): void {
        this.buttonsEl.empty();

        if (!this.stateManager.isAnswerRevealed()) {
            // Show answer button
            const showBtn = this.buttonsEl.createEl("button", {
                cls: "shadow-anki-btn shadow-anki-btn-show",
                text: "Show Answer",
            });
            showBtn.addEventListener("click", () => this.handleShowAnswer());
        } else {
            // Rating buttons
            const preview = this.stateManager.getSchedulingPreview();
            this.renderRatingButton("Again", Rating.Again, "shadow-anki-btn-again", preview?.again.interval);
            this.renderRatingButton("Hard", Rating.Hard, "shadow-anki-btn-hard", preview?.hard.interval);
            this.renderRatingButton("Good", Rating.Good, "shadow-anki-btn-good", preview?.good.interval);
            this.renderRatingButton("Easy", Rating.Easy, "shadow-anki-btn-easy", preview?.easy.interval);
        }
    }

    /**
     * Render a single rating button
     */
    private renderRatingButton(
        label: string,
        rating: Grade,
        cls: string,
        interval?: string
    ): void {
        const btn = this.buttonsEl.createEl("button", { cls: `shadow-anki-btn ${cls}` });

        btn.createDiv({ cls: "shadow-anki-btn-label", text: label });

        if (interval && this.plugin.settings.showNextReviewTime) {
            btn.createDiv({ cls: "shadow-anki-btn-time", text: interval });
        }

        btn.addEventListener("click", () => this.handleAnswer(rating));
    }

    /**
     * Render progress bar
     */
    private renderProgress(): void {
        this.progressEl.empty();

        if (!this.plugin.settings.showProgress) {
            return;
        }

        const progress = this.stateManager.getProgress();

        const progressBar = this.progressEl.createDiv({ cls: "shadow-anki-progress-bar" });
        const progressFill = progressBar.createDiv({ cls: "shadow-anki-progress-fill" });
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

        const emptyEl = this.cardContainerEl.createDiv({ cls: "shadow-anki-review-empty" });
        emptyEl.createDiv({ cls: "shadow-anki-review-empty-icon", text: "🎉" });
        emptyEl.createDiv({ cls: "shadow-anki-review-empty-text", text: message });

        const closeBtn = emptyEl.createEl("button", {
            cls: "shadow-anki-btn shadow-anki-btn-primary",
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

        const summaryEl = this.cardContainerEl.createDiv({ cls: "shadow-anki-review-summary" });
        summaryEl.createEl("h2", { text: "Session Complete!" });

        const statsEl = summaryEl.createDiv({ cls: "shadow-anki-review-stats" });

        this.renderStatItem(statsEl, "Total Reviewed", stats.reviewed.toString());
        this.renderStatItem(statsEl, "Again", stats.again.toString(), "stat-again");
        this.renderStatItem(statsEl, "Hard", stats.hard.toString(), "stat-hard");
        this.renderStatItem(statsEl, "Good", stats.good.toString(), "stat-good");
        this.renderStatItem(statsEl, "Easy", stats.easy.toString(), "stat-easy");

        const durationMin = Math.floor(stats.duration / 60000);
        const durationSec = Math.floor((stats.duration % 60000) / 1000);
        this.renderStatItem(statsEl, "Duration", `${durationMin}m ${durationSec}s`);

        const buttonsEl = summaryEl.createDiv({ cls: "shadow-anki-review-summary-buttons" });

        const closeBtn = buttonsEl.createEl("button", {
            cls: "shadow-anki-btn shadow-anki-btn-primary",
            text: "Close",
        });
        closeBtn.addEventListener("click", () => this.handleClose());
    }

    /**
     * Render a stat item
     */
    private renderStatItem(container: HTMLElement, label: string, value: string, cls?: string): void {
        const itemEl = container.createDiv({ cls: `shadow-anki-stat-item ${cls ?? ""}` });
        itemEl.createDiv({ cls: "shadow-anki-stat-label", text: label });
        itemEl.createDiv({ cls: "shadow-anki-stat-value", text: value });
    }

    /**
     * Update scheduling preview for current card
     */
    private updateSchedulingPreview(): void {
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

    private async handleAnswer(rating: Grade): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        // Process the answer
        const { updatedCard } = this.reviewService.processAnswer(
            card,
            rating,
            this.fsrsService,
            Date.now() - this.stateManager.getState().questionShownTime
        );

        // Save to file
        try {
            await this.flashcardManager.updateCardFSRS(
                card.filePath,
                card.id,
                updatedCard.fsrs,
                card.lineNumber
            );
        } catch (error) {
            console.error("Error saving card:", error);
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

    private async handleEdit(): Promise<void> {
        const card = this.stateManager.getCurrentCard();
        if (!card) return;

        // Open the file at the card's line number
        await this.flashcardManager.openFileAtLine(
            this.app.vault.getAbstractFileByPath(card.filePath) as any,
            card.lineNumber
        );
    }

    private handleClose(): void {
        this.leaf.detach();
    }
}
