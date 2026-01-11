/**
 * Diff Card Component
 * Displays a flashcard change with accept/reject functionality
 */
import type { App, Component, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type { FlashcardChange, FlashcardItem } from "../../types";
import { BaseComponent } from "../component.base";
import { createCardReviewItem } from "./CardReviewItem";

export interface DiffCardHandlers {
    app: App;
    component: Component;
    leaf?: WorkspaceLeaf;
    onAccept?: (change: FlashcardChange, index: number) => void;
    onReject?: (change: FlashcardChange, index: number) => void;
    onEditChange?: (change: FlashcardChange, field: "question" | "answer", newContent: string) => void;
}

export interface DiffCardProps {
    change: FlashcardChange;
    index: number;
    filePath: string;
    handlers: DiffCardHandlers;
    markdownRenderer: typeof MarkdownRenderer;
}

/**
 * Get CSS class for change type
 */
function getChangeTypeClass(type: FlashcardChange["type"]): string {
    switch (type) {
        case "NEW":
            return "episteme-diff-card--new";
        case "MODIFIED":
            return "episteme-diff-card--modified";
        case "DELETED":
            return "episteme-diff-card--deleted";
        default:
            return "";
    }
}

/**
 * Get label for change type
 */
function getChangeTypeLabel(type: FlashcardChange["type"]): string {
    switch (type) {
        case "NEW":
            return "NEW";
        case "MODIFIED":
            return "MODIFIED";
        case "DELETED":
            return "DELETE";
        default:
            return type;
    }
}

/**
 * Diff card component for displaying proposed changes
 */
export class DiffCard extends BaseComponent {
    private props: DiffCardProps;
    private acceptedState: boolean;

    constructor(container: HTMLElement, props: DiffCardProps) {
        super(container);
        this.props = props;
        this.acceptedState = props.change.accepted;
    }

    render(): void {
        // Clear existing element if any
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        const { change, index } = this.props;

        // Create card wrapper
        this.element = this.container.createDiv({
            cls: `episteme-diff-card ${getChangeTypeClass(change.type)}`,
        });

        // Update visual state based on accepted status
        this.updateAcceptedVisuals();

        // Header with type badge and actions
        this.renderHeader();

        // Content section
        this.renderContent();

        // Reason for deletion (if applicable)
        if (change.type === "DELETED" && change.reason) {
            this.element.createDiv({
                text: `Reason: ${change.reason}`,
                cls: "episteme-diff-reason",
            });
        }
    }

    private renderHeader(): void {
        const { change, index, handlers } = this.props;

        if (!this.element) return;

        const header = this.element.createDiv({
            cls: "episteme-diff-card-header",
        });

        // Type badge
        const badge = header.createSpan({
            cls: `episteme-diff-badge episteme-diff-badge--${change.type.toLowerCase()}`,
        });
        badge.textContent = getChangeTypeLabel(change.type);

        // Checkbox toggle
        const checkbox = header.createEl("input", {
            cls: "episteme-diff-toggle",
            attr: { type: "checkbox" },
        });
        checkbox.checked = this.acceptedState;
        this.events.addEventListener(checkbox, "change", () => {
            const accepted = checkbox.checked;
            this.setAccepted(accepted);
            if (accepted) {
                handlers.onAccept?.(change, index);
            } else {
                handlers.onReject?.(change, index);
            }
        });
    }

    /**
     * Convert FlashcardChange to FlashcardItem for CardReviewItem
     */
    private changeToCardData(change: FlashcardChange): FlashcardItem {
        return {
            question: change.question,
            answer: change.answer,
            id: change.originalCardId ?? `diff-${this.props.index}-${change.type}`,
        };
    }

    private renderContent(): void {
        const { change, filePath, handlers, markdownRenderer } = this.props;

        if (!this.element) return;

        const content = this.element.createDiv({
            cls: "episteme-diff-content",
        });

        // For DELETED cards - use existing strikethrough rendering
        if (change.type === "DELETED") {
            this.renderDeletedContent(content, change, filePath, handlers, markdownRenderer);
            this.setupInternalLinkHandler(content);
            return;
        }

        // For MODIFIED cards - show original content first
        if (change.type === "MODIFIED") {
            this.renderOriginalContent(content, change, filePath, handlers, markdownRenderer);
        }

        // Use CardReviewItem for NEW/MODIFIED content
        const cardData = this.changeToCardData(change);
        createCardReviewItem(content, {
            card: cardData,
            filePath: this.props.filePath,
            app: handlers.app,
            component: handlers.component,
            // No onClick (don't navigate away)
            // No onDelete (not applicable)
            // No onOpen (not applicable)
            onEditSave: async (card, field, newContent) => {
                // Update the FlashcardChange object
                handlers.onEditChange?.(change, field, newContent);
                // Update the card data and re-render
                this.props.change[field] = newContent;
                this.render();
            },
        });
    }

    /**
     * Render original (strikethrough) content for MODIFIED cards
     */
    private renderOriginalContent(
        content: HTMLElement,
        change: FlashcardChange,
        filePath: string,
        handlers: DiffCardHandlers,
        markdownRenderer: typeof MarkdownRenderer
    ): void {
        // Original question (strikethrough)
        if (change.originalQuestion) {
            const originalQ = content.createDiv({
                cls: "episteme-diff-original",
            });
            originalQ.createSpan({
                text: "Q (old): ",
                cls: "episteme-card-label episteme-diff-label-old",
            });
            const origQContent = originalQ.createDiv({
                cls: "episteme-md-content episteme-strikethrough",
            });
            void markdownRenderer.render(
                handlers.app,
                change.originalQuestion,
                origQContent,
                filePath,
                handlers.component
            );
        }

        // Original answer (strikethrough)
        if (change.originalAnswer) {
            const originalA = content.createDiv({
                cls: "episteme-diff-original",
            });
            originalA.createSpan({
                text: "A (old): ",
                cls: "episteme-card-label episteme-diff-label-old",
            });
            const origAContent = originalA.createDiv({
                cls: "episteme-md-content episteme-strikethrough",
            });
            void markdownRenderer.render(
                handlers.app,
                change.originalAnswer,
                origAContent,
                filePath,
                handlers.component
            );
        }
    }

    /**
     * Render deleted content (strikethrough) for DELETED cards
     */
    private renderDeletedContent(
        content: HTMLElement,
        change: FlashcardChange,
        filePath: string,
        handlers: DiffCardHandlers,
        markdownRenderer: typeof MarkdownRenderer
    ): void {
        // Question being deleted
        const questionEl = content.createDiv({
            cls: "episteme-diff-question episteme-diff-deleted-content",
        });
        questionEl.createSpan({
            text: "Q: ",
            cls: "episteme-card-label",
        });
        const qContent = questionEl.createDiv({
            cls: "episteme-md-content episteme-strikethrough",
        });
        void markdownRenderer.render(
            handlers.app,
            change.question,
            qContent,
            filePath,
            handlers.component
        );

        // Answer being deleted
        const answerEl = content.createDiv({
            cls: "episteme-diff-answer episteme-diff-deleted-content",
        });
        answerEl.createSpan({
            text: "A: ",
            cls: "episteme-card-label",
        });
        const aContent = answerEl.createDiv({
            cls: "episteme-md-content episteme-strikethrough",
        });
        void markdownRenderer.render(
            handlers.app,
            change.answer,
            aContent,
            filePath,
            handlers.component
        );
    }

    /**
     * Set the accepted state and update visuals
     */
    setAccepted(accepted: boolean): void {
        this.acceptedState = accepted;
        this.updateAcceptedVisuals();
    }

    /**
     * Get current accepted state
     */
    isAccepted(): boolean {
        return this.acceptedState;
    }

    private updateAcceptedVisuals(): void {
        if (!this.element) return;

        if (this.acceptedState) {
            this.element.removeClass("episteme-diff-card--rejected");
        } else {
            this.element.addClass("episteme-diff-card--rejected");
        }

        // Update checkbox state
        const checkbox = this.element.querySelector(".episteme-diff-toggle") as HTMLInputElement;
        if (checkbox) {
            checkbox.checked = this.acceptedState;
        }
    }

    /**
     * Setup click handler for internal links on container
     * Uses capture phase to intercept before Obsidian's handlers
     */
    private setupInternalLinkHandler(container: HTMLElement): void {
        const { filePath, handlers } = this.props;

        // Use capture phase to intercept before Obsidian's default handlers
        container.addEventListener("click", (e: MouseEvent) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const linkEl = target.closest("a.internal-link");
            if (!linkEl) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const href = linkEl.getAttribute("data-href");
            if (!href) return;

            // Open in existing tab if available, otherwise new tab
            const existingLeaf = handlers.app.workspace.getMostRecentLeaf();
            if (existingLeaf && existingLeaf !== handlers.leaf) {
                void handlers.app.workspace.openLinkText(href, filePath, false);
            } else {
                void handlers.app.workspace.openLinkText(href, filePath, "tab");
            }
        }, true); // capture: true
    }

}

/**
 * Create a diff card component
 */
export function createDiffCard(
    container: HTMLElement,
    props: DiffCardProps
): DiffCard {
    const card = new DiffCard(container, props);
    card.render();
    return card;
}
