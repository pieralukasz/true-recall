/**
 * Loading Spinner Component
 * Displays a loading indicator with optional message
 */
import { BaseComponent } from "../component.base";

export interface LoadingSpinnerProps {
    message?: string;
    subMessage?: string;
}

/**
 * Loading spinner component with customizable messages
 */
export class LoadingSpinner extends BaseComponent {
    private props: LoadingSpinnerProps;
    private messageEl: HTMLElement | null = null;
    private subMessageEl: HTMLElement | null = null;

    constructor(container: HTMLElement, props: LoadingSpinnerProps = {}) {
        super(container);
        this.props = {
            message: "Loading...",
            subMessage: "",
            ...props,
        };
    }

    render(): void {
        // Clear existing element if any
        if (this.element) {
            this.element.remove();
        }

        this.element = this.container.createDiv({
            cls: "shadow-anki-processing",
        });

        // Spinner SVG
        const spinnerEl = this.element.createDiv({
            cls: "shadow-anki-spinner",
        });
        spinnerEl.innerHTML = this.getSpinnerSVG();

        // Message text
        this.messageEl = this.element.createDiv({
            text: this.props.message,
            cls: "shadow-anki-processing-text",
        });

        // Sub-message text
        if (this.props.subMessage) {
            this.subMessageEl = this.element.createDiv({
                text: this.props.subMessage,
                cls: "shadow-anki-processing-subtext",
            });
        }
    }

    /**
     * Update the loading message
     */
    setMessage(message: string): void {
        this.props.message = message;
        if (this.messageEl) {
            this.messageEl.textContent = message;
        }
    }

    /**
     * Update the sub-message
     */
    setSubMessage(subMessage: string): void {
        this.props.subMessage = subMessage;
        if (this.subMessageEl) {
            this.subMessageEl.textContent = subMessage;
        } else if (subMessage && this.element) {
            this.subMessageEl = this.element.createDiv({
                text: subMessage,
                cls: "shadow-anki-processing-subtext",
            });
        }
    }

    private getSpinnerSVG(): string {
        return `<svg viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round">
                <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
            </circle>
        </svg>`;
    }
}

/**
 * Create a loading spinner component
 */
export function createLoadingSpinner(
    container: HTMLElement,
    props?: LoadingSpinnerProps
): LoadingSpinner {
    const spinner = new LoadingSpinner(container, props);
    spinner.render();
    return spinner;
}
