/**
 * Session Footer Component
 * Contains start session button and clear selection
 */
import { BaseComponent } from "../component.base";

export interface SessionFooterProps {
	selectionCount: number;
	onStartSession: () => void;
	onClearSelection: () => void;
}

/**
 * Session footer component
 */
export class SessionFooter extends BaseComponent {
	private props: SessionFooterProps;
	private startButtonEl: HTMLButtonElement | null = null;

	constructor(container: HTMLElement, props: SessionFooterProps) {
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
			cls: "episteme-session-footer",
		});

		const buttonContainer = this.element.createDiv({
			cls: "episteme-session-buttons",
		});

		// Clear selection button (only show when there are selections)
		if (this.props.selectionCount > 0) {
			const clearBtn = buttonContainer.createEl("button", {
				cls: "episteme-clear-session-btn",
				text: "Clear selection",
			});
			this.events.addEventListener(clearBtn, "click", () => {
				this.props.onClearSelection();
			});
		}

		// Start button
		this.startButtonEl = buttonContainer.createEl("button", {
			cls: "mod-cta episteme-start-session-btn",
		});
		this.updateStartButton();

		this.events.addEventListener(this.startButtonEl, "click", () => {
			this.props.onStartSession();
		});
	}

	private updateStartButton(): void {
		if (!this.startButtonEl) return;

		const count = this.props.selectionCount;
		if (count === 0) {
			this.startButtonEl.disabled = true;
			this.startButtonEl.textContent = "Select notes to start";
		} else {
			this.startButtonEl.disabled = false;
			this.startButtonEl.textContent =
				count === 1 ? "Start session (1 note)" : `Start session (${count} notes)`;
		}
	}

	/**
	 * Update the footer with new props
	 */
	updateProps(props: Partial<SessionFooterProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
