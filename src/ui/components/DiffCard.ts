/**
 * Diff Card Component
 * Displays a flashcard change with accept/reject functionality
 */
import type { App, Component, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type { FlashcardChange } from "../../types";
import { BaseComponent } from "../component.base";

export interface DiffCardHandlers {
    app: App;
    component: Component;
    leaf?: WorkspaceLeaf;
    onAccept?: (change: FlashcardChange, index: number) => void;
    onReject?: (change: FlashcardChange, index: number) => void;
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
            return "shadow-anki-diff-card--new";
        case "MODIFIED":
            return "shadow-anki-diff-card--modified";
        case "DELETED":
            return "shadow-anki-diff-card--deleted";
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
            cls: `shadow-anki-diff-card ${getChangeTypeClass(change.type)}`,
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
                cls: "shadow-anki-diff-reason",
            });
        }
    }

    private renderHeader(): void {
        const { change, index, handlers } = this.props;

        if (!this.element) return;

        const header = this.element.createDiv({
            cls: "shadow-anki-diff-card-header",
        });

        // Type badge
        const badge = header.createSpan({
            cls: `shadow-anki-diff-badge shadow-anki-diff-badge--${change.type.toLowerCase()}`,
        });
        badge.textContent = getChangeTypeLabel(change.type);

        // Checkbox toggle
        const checkbox = header.createEl("input", {
            cls: "shadow-anki-diff-toggle",
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

    private renderContent(): void {
        const { change, filePath, handlers, markdownRenderer } = this.props;

        if (!this.element) return;

        const content = this.element.createDiv({
            cls: "shadow-anki-diff-content",
        });

        // For MODIFIED - show original (crossed out) and new
        if (change.type === "MODIFIED" && change.originalQuestion) {
            // Original question (strikethrough)
            const originalQ = content.createDiv({
                cls: "shadow-anki-diff-original",
            });
            originalQ.createSpan({
                text: "Q (old): ",
                cls: "shadow-anki-card-label shadow-anki-diff-label-old",
            });
            const origQContent = originalQ.createDiv({
                cls: "shadow-anki-md-content shadow-anki-strikethrough",
            });
            void markdownRenderer.render(
                handlers.app,
                change.originalQuestion,
                origQContent,
                filePath,
                handlers.component
            );
        }

        // New/Modified question
        if (change.type !== "DELETED") {
            const questionEl = content.createDiv({
                cls: "shadow-anki-diff-question",
            });
            questionEl.createSpan({
                text: change.type === "MODIFIED" ? "Q (new): " : "Q: ",
                cls: `shadow-anki-card-label ${change.type === "MODIFIED" ? "shadow-anki-diff-label-new" : ""}`,
            });
            const qContent = questionEl.createDiv({
                cls: "shadow-anki-md-content",
            });
            void markdownRenderer.render(
                handlers.app,
                change.question,
                qContent,
                filePath,
                handlers.component
            );
        } else {
            // For DELETED - show question being deleted
            const questionEl = content.createDiv({
                cls: "shadow-anki-diff-question shadow-anki-diff-deleted-content",
            });
            questionEl.createSpan({
                text: "Q: ",
                cls: "shadow-anki-card-label",
            });
            const qContent = questionEl.createDiv({
                cls: "shadow-anki-md-content shadow-anki-strikethrough",
            });
            void markdownRenderer.render(
                handlers.app,
                change.question,
                qContent,
                filePath,
                handlers.component
            );
        }

        // For MODIFIED - show original answer (crossed out)
        if (change.type === "MODIFIED" && change.originalAnswer) {
            const originalA = content.createDiv({
                cls: "shadow-anki-diff-original",
            });
            originalA.createSpan({
                text: "A (old): ",
                cls: "shadow-anki-card-label shadow-anki-diff-label-old",
            });
            const origAContent = originalA.createDiv({
                cls: "shadow-anki-md-content shadow-anki-strikethrough",
            });
            void markdownRenderer.render(
                handlers.app,
                change.originalAnswer,
                origAContent,
                filePath,
                handlers.component
            );
        }

        // New/Modified answer
        if (change.type !== "DELETED") {
            const answerEl = content.createDiv({
                cls: "shadow-anki-diff-answer",
            });
            answerEl.createSpan({
                text: change.type === "MODIFIED" ? "A (new): " : "A: ",
                cls: `shadow-anki-card-label ${change.type === "MODIFIED" ? "shadow-anki-diff-label-new" : ""}`,
            });
            const aContent = answerEl.createDiv({
                cls: "shadow-anki-md-content",
            });
            void markdownRenderer.render(
                handlers.app,
                change.answer,
                aContent,
                filePath,
                handlers.component
            );
        } else {
            // For DELETED - show answer being deleted
            const answerEl = content.createDiv({
                cls: "shadow-anki-diff-answer shadow-anki-diff-deleted-content",
            });
            answerEl.createSpan({
                text: "A: ",
                cls: "shadow-anki-card-label",
            });
            const aContent = answerEl.createDiv({
                cls: "shadow-anki-md-content shadow-anki-strikethrough",
            });
            void markdownRenderer.render(
                handlers.app,
                change.answer,
                aContent,
                filePath,
                handlers.component
            );
        }

        // Setup click handler for internal links on the content container
        this.setupInternalLinkHandler(content);
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
            this.element.removeClass("shadow-anki-diff-card--rejected");
        } else {
            this.element.addClass("shadow-anki-diff-card--rejected");
        }

        // Update checkbox state
        const checkbox = this.element.querySelector(".shadow-anki-diff-toggle") as HTMLInputElement;
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
            const linkEl = (e.target as HTMLElement).closest("a.internal-link");
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
