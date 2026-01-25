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
            cls: "ep:flex ep:flex-col ep:flex-1 ep:overflow-y-auto",
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

        const stateEl = this.element.createDiv({ cls: "ep:py-4 ep:text-center" });
        stateEl.createEl("p", { text: "No flashcards", cls: "ep:text-sm ep:text-obs-muted ep:m-0" });
    }

    private renderPreviewState(): void {
        const { flashcardInfo, handlers } = this.props;

        if (!this.element || !flashcardInfo) return;

        const previewEl = this.element.createDiv({
            cls: "ep:py-2",
        });

        // Card count and last modified
        const metaEl = previewEl.createDiv({ cls: "ep:mb-2" });
        metaEl.createSpan({
            text: `${flashcardInfo.cardCount} flashcard${flashcardInfo.cardCount !== 1 ? "s" : ""}`,
            cls: "ep:text-sm ep:font-medium ep:text-obs-normal",
        });
        if (flashcardInfo.lastModified) {
            const date = new Date(flashcardInfo.lastModified);
            metaEl.createSpan({
                text: ` \u2022 ${this.formatDate(date)}`,
                cls: "ep:text-sm ep:text-obs-muted",
            });
        }

        // Flashcard list
        if (flashcardInfo.flashcards.length > 0) {
            const cardsContainer = previewEl.createDiv({
                cls: "ep:mb-2",
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
                        cls: "ep:h-px ep:bg-obs-border ep:my-2",
                    });
                }
            }
        }
    }

    private renderDiffState(): void {
        const { diffResult, currentFile, handlers } = this.props;

        if (!this.element || !diffResult || !currentFile) return;

        const diffEl = this.element.createDiv({
            cls: "ep:py-2",
        });

        // Header with count
        const acceptedCount = diffResult.changes.filter((c) => c.accepted).length;
        const totalCount = diffResult.changes.length;

        const headerEl = diffEl.createDiv({ cls: "ep:flex ep:items-center ep:mb-3" });
        headerEl.createSpan({
            text: `Proposed Changes (${acceptedCount}/${totalCount} selected)`,
            cls: "ep:text-sm ep:font-semibold ep:text-obs-normal",
        });

        // Select All / Deselect All button
        const allSelected = acceptedCount === totalCount;
        const selectAllBtn = headerEl.createEl("button", {
            text: allSelected ? "Deselect all" : "Select all",
            cls: "ep:ml-auto ep:px-2 ep:py-1 ep:text-xs ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors",
        });

        if (handlers.onSelectAll) {
            this.events.addEventListener(selectAllBtn, "click", () => {
                handlers.onSelectAll?.(!allSelected);
            });
        }

        // No changes case
        if (diffResult.changes.length === 0) {
            diffEl.createDiv({
                text: "No changes needed. Flashcards are up to date.",
                cls: "ep:text-obs-muted ep:text-center ep:py-6 ep:px-3",
            });
            return;
        }

        // Render each change
        const changesContainer = diffEl.createDiv({
            cls: "ep:flex ep:flex-col ep:gap-3",
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
