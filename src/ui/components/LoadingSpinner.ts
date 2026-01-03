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
			cls: "episteme-processing",
		});

		// Spinner SVG
		const spinnerEl = this.element.createDiv({
			cls: "episteme-spinner",
		});
		this.createSpinnerSVG(spinnerEl);

		// Message text
		this.messageEl = this.element.createDiv({
			text: this.props.message,
			cls: "episteme-processing-text",
		});

		// Sub-message text
		if (this.props.subMessage) {
			this.subMessageEl = this.element.createDiv({
				text: this.props.subMessage,
				cls: "episteme-processing-subtext",
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
				cls: "episteme-processing-subtext",
			});
		}
	}

	private createSpinnerSVG(container: HTMLElement): void {
		const svg = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"svg"
		);
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", "32");
		svg.setAttribute("height", "32");

		const circle = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle"
		);
		circle.setAttribute("cx", "12");
		circle.setAttribute("cy", "12");
		circle.setAttribute("r", "10");
		circle.setAttribute("stroke", "currentColor");
		circle.setAttribute("stroke-width", "3");
		circle.setAttribute("fill", "none");
		circle.setAttribute("stroke-dasharray", "31.4 31.4");
		circle.setAttribute("stroke-linecap", "round");

		const animateTransform = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"animateTransform"
		);
		animateTransform.setAttribute("attributeName", "transform");
		animateTransform.setAttribute("type", "rotate");
		animateTransform.setAttribute("dur", "1s");
		animateTransform.setAttribute("from", "0 12 12");
		animateTransform.setAttribute("to", "360 12 12");
		animateTransform.setAttribute("repeatCount", "indefinite");

		circle.appendChild(animateTransform);
		svg.appendChild(circle);
		container.appendChild(svg);
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
