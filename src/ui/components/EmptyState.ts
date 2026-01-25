/**
 * Empty State Component
 * Displays a message when there's no content to show
 */
import { BaseComponent } from "../component.base";

export interface EmptyStateProps {
    message: string;
    icon?: string;
    actionLabel?: string;
    onAction?: () => void;
}

/**
 * Empty state component for displaying placeholder messages
 */
export class EmptyState extends BaseComponent {
    private props: EmptyStateProps;
    private messageEl: HTMLElement | null = null;

    constructor(container: HTMLElement, props: EmptyStateProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        // Clear existing element if any
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        this.element = this.container.createDiv({
            cls: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:flex-1 ep:text-obs-muted ep:text-center ep:py-4 ep:px-2",
        });

        // Optional icon
        if (this.props.icon) {
            const iconEl = this.element.createDiv({
                cls: "ep:text-3xl ep:mb-2",
            });
            iconEl.textContent = this.props.icon;
        }

        // Message
        this.messageEl = this.element.createDiv({
            text: this.props.message,
        });

        // Optional action button
        if (this.props.actionLabel && this.props.onAction) {
            const actionBtn = this.element.createEl("button", {
                text: this.props.actionLabel,
                cls: "ep:mt-3 mod-cta",
            });
            this.events.addEventListener(actionBtn, "click", () => {
                this.props.onAction?.();
            });
        }
    }

    /**
     * Update the message
     */
    setMessage(message: string): void {
        this.props.message = message;
        if (this.messageEl) {
            this.messageEl.textContent = message;
        }
    }
}

/**
 * Create an empty state component
 */
export function createEmptyState(
    container: HTMLElement,
    props: EmptyStateProps
): EmptyState {
    const emptyState = new EmptyState(container, props);
    emptyState.render();
    return emptyState;
}

/**
 * Predefined empty state messages
 */
export const EmptyStateMessages = {
    NO_FILE: "Open a note to see flashcard options",
    NOT_MARKDOWN: "Select a markdown file",
    NO_FLASHCARDS: "No flashcards yet for this note.",
    LOADING: "Loading flashcards...",
    ERROR: "An error occurred",
} as const;
