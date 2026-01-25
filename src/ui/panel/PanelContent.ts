/**
 * Panel Content Component
 * Displays the main content area of the flashcard panel
 */
import type { App, Component, TFile, MarkdownRenderer } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProcessingStatus, ViewMode } from "../../state";
import type { FlashcardInfo, FlashcardItem, FlashcardChange, DiffResult, NoteFlashcardType } from "../../types";
import { createLoadingSpinner } from "../components/LoadingSpinner";
import { createEmptyState, EmptyStateMessages } from "../components/EmptyState";
import { createCardReviewItem } from "../components/CardReviewItem";
import { createDiffCard } from "../components/DiffCard";

export interface PanelContentHandlers {
    app: App;
    component: Component;
    markdownRenderer: typeof MarkdownRenderer;
    onEditCard?: (card: FlashcardItem) => void;
    onEditButton?: (card: FlashcardItem) => void;
    onCopyCard?: (card: FlashcardItem) => void;
    onDeleteCard?: (card: FlashcardItem) => void;
    onMoveCard?: (card: FlashcardItem) => void;
    onChangeAccept?: (change: FlashcardChange, index: number, accepted: boolean) => void;
    onSelectAll?: (selected: boolean) => void;
    // In-place edit save handler
    onEditSave?: (card: FlashcardItem, field: "question" | "answer", newContent: string) => Promise<void>;
    // Diff edit change handler
    onEditChange?: (change: FlashcardChange, field: "question" | "answer", newContent: string) => void;
}

export interface PanelContentProps {
    currentFile: TFile | null;
    status: ProcessingStatus;
    viewMode: ViewMode;
    flashcardInfo: FlashcardInfo | null;
    diffResult: DiffResult | null;
    isFlashcardFile: boolean;
    // Note flashcard type based on tags
    noteFlashcardType?: NoteFlashcardType;
    handlers: PanelContentHandlers;
}

/**
 * Panel content component
 */
export class PanelContent extends BaseComponent {
    private props: PanelContentProps;
    private childComponents: BaseComponent[] = [];

    constructor(container: HTMLElement, props: PanelContentProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        // Cleanup child components
        this.cleanupChildren();

        // Clear existing element if any
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        this.element = this.container.createDiv({
            cls: "episteme-content",
        });

        const { status, viewMode, diffResult, currentFile } = this.props;

        // Show loader if processing
        if (status === "processing") {
            this.renderProcessingState();
            return;
        }

        // Show diff view if in diff mode
        if (viewMode === "diff" && diffResult) {
            this.renderDiffState();
            return;
        }

        // No file selected
        if (!currentFile) {
            this.renderEmptyState(EmptyStateMessages.NO_FILE);
            return;
        }

        // Not markdown file
        if (currentFile.extension !== "md") {
            this.renderEmptyState(EmptyStateMessages.NOT_MARKDOWN);
            return;
        }

        // Render based on flashcard existence
        const { flashcardInfo } = this.props;
        if (!flashcardInfo?.exists) {
            this.renderNoFlashcardsState();
        } else {
            this.renderPreviewState();
        }
    }

    private renderProcessingState(): void {
        if (!this.element) return;

        const spinner = createLoadingSpinner(this.element, {
            message: "Generating flashcards...",
            subMessage: "AI is analyzing your note",
        });
        this.childComponents.push(spinner);
    }

    private renderEmptyState(message: string): void {
        if (!this.element) return;

        const emptyState = createEmptyState(this.element, { message });
        this.childComponents.push(emptyState);
    }

    private renderNoFlashcardsState(): void {
        if (!this.element) return;

        const stateEl = this.element.createDiv({ cls: "episteme-no-cards" });
        stateEl.createEl("p", { text: "No flashcards", cls: "episteme-no-cards-message" });
    }

    private renderPreviewState(): void {
        const { flashcardInfo, handlers } = this.props;

        if (!this.element || !flashcardInfo) return;

        const previewEl = this.element.createDiv({
            cls: "episteme-preview",
        });

        // Card count and last modified
        const metaEl = previewEl.createDiv({ cls: "episteme-meta-row" });
        metaEl.createSpan({
            text: `${flashcardInfo.cardCount} flashcard${flashcardInfo.cardCount !== 1 ? "s" : ""}`,
            cls: "episteme-card-count",
        });
        if (flashcardInfo.lastModified) {
            const date = new Date(flashcardInfo.lastModified);
            metaEl.createSpan({
                text: ` \u2022 ${this.formatDate(date)}`,
                cls: "episteme-meta",
            });
        }

        // Flashcard list
        if (flashcardInfo.flashcards.length > 0) {
            const cardsContainer = previewEl.createDiv({
                cls: "episteme-cards-container",
            });

            for (let index = 0; index < flashcardInfo.flashcards.length; index++) {
                const card = flashcardInfo.flashcards[index];
                if (!card) continue;

                const cardWrapper = cardsContainer.createDiv();

                const cardReviewItem = createCardReviewItem(cardWrapper, {
                    card,
                    filePath: this.props.currentFile?.path || "",
                    app: handlers.app,
                    component: handlers.component,
                    onClick: handlers.onEditCard,
                    onDelete: handlers.onDeleteCard,
                    onCopy: handlers.onCopyCard,
                    onMove: handlers.onMoveCard,
                    onEditSave: handlers.onEditSave,
                    onEditButton: handlers.onEditButton,
                });
                this.childComponents.push(cardReviewItem);

                // Separator (except for last card)
                if (index < flashcardInfo.flashcards.length - 1) {
                    cardWrapper.createDiv({
                        cls: "episteme-card-separator",
                    });
                }
            }
        }
    }

    private renderDiffState(): void {
        const { diffResult, currentFile, handlers } = this.props;

        if (!this.element || !diffResult || !currentFile) return;

        const diffEl = this.element.createDiv({
            cls: "episteme-diff",
        });

        // Header with count
        const acceptedCount = diffResult.changes.filter((c) => c.accepted).length;
        const totalCount = diffResult.changes.length;

        const headerEl = diffEl.createDiv({ cls: "episteme-diff-header" });
        headerEl.createSpan({
            text: `Proposed Changes (${acceptedCount}/${totalCount} selected)`,
            cls: "episteme-diff-title",
        });

        // Select All / Deselect All button
        const allSelected = acceptedCount === totalCount;
        const selectAllBtn = headerEl.createEl("button", {
            text: allSelected ? "Deselect all" : "Select all",
            cls: "episteme-btn-secondary",
        });
        selectAllBtn.style.marginLeft = "auto";
        selectAllBtn.style.padding = "4px 8px";
        selectAllBtn.style.fontSize = "12px";

        if (handlers.onSelectAll) {
            this.events.addEventListener(selectAllBtn, "click", () => {
                handlers.onSelectAll?.(!allSelected);
            });
        }

        // No changes case
        if (diffResult.changes.length === 0) {
            diffEl.createDiv({
                text: "No changes needed. Flashcards are up to date.",
                cls: "episteme-diff-empty",
            });
            return;
        }

        // Render each change
        const changesContainer = diffEl.createDiv({
            cls: "episteme-diff-changes",
        });

        for (let i = 0; i < diffResult.changes.length; i++) {
            const change = diffResult.changes[i];
            if (!change) continue;

            const diffCard = createDiffCard(changesContainer, {
                change,
                index: i,
                filePath: currentFile.path,
                handlers: {
                    app: handlers.app,
                    component: handlers.component,
                    onAccept: (c, idx) => handlers.onChangeAccept?.(c, idx, true),
                    onReject: (c, idx) => handlers.onChangeAccept?.(c, idx, false),
                    onEditChange: handlers.onEditChange,
                },
                markdownRenderer: handlers.markdownRenderer,
            });
            this.childComponents.push(diffCard);
        }
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return `Today ${date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}`;
        }

        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
    }

    private cleanupChildren(): void {
        this.childComponents.forEach((comp) => comp.destroy());
        this.childComponents = [];
    }

    /**
     * Update the content with new props
     */
    updateProps(props: Partial<PanelContentProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }

    destroy(): void {
        this.cleanupChildren();
        super.destroy();
    }
}

/**
 * Create a panel content component
 */
export function createPanelContent(
    container: HTMLElement,
    props: PanelContentProps
): PanelContent {
    const content = new PanelContent(container, props);
    content.render();
    return content;
}
