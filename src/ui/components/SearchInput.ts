/**
 * SearchInput Component
 * Styled search input with consistent appearance
 */
import { BaseComponent } from "../component.base";

export interface SearchInputProps {
	value: string;
	placeholder: string;
	onChange: (query: string) => void;
	/** Auto-focus on mount */
	autoFocus?: boolean;
	/** Additional CSS classes for container */
	className?: string;
}

/**
 * Styled search input using Obsidian theme colors
 */
export class SearchInput extends BaseComponent {
	private props: SearchInputProps;
	private inputEl: HTMLInputElement | null = null;

	constructor(container: HTMLElement, props: SearchInputProps) {
		super(container);
		this.props = {
			autoFocus: false,
			...props,
		};
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { value, placeholder, onChange, autoFocus, className } = this.props;

		// Container div
		this.element = this.container.createDiv({
			cls: className ?? "",
		});

		// Input element
		this.inputEl = this.element.createEl("input", {
			cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
			type: "text",
			placeholder,
		});
		this.inputEl.value = value;

		this.events.addEventListener(this.inputEl, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			onChange(query);
		});

		if (autoFocus) {
			setTimeout(() => this.inputEl?.focus(), 50);
		}
	}

	updateProps(props: Partial<SearchInputProps>): void {
		const valueChanged = props.value !== undefined && props.value !== this.props.value;
		this.props = { ...this.props, ...props };

		// Only update input value if it changed externally
		if (valueChanged && this.inputEl) {
			this.inputEl.value = this.props.value;
		}
	}

	focus(): void {
		this.inputEl?.focus();
	}

	getValue(): string {
		return this.inputEl?.value ?? "";
	}

	/**
	 * Get the input element for external manipulation
	 */
	getInputElement(): HTMLInputElement | null {
		return this.inputEl;
	}
}

/**
 * Factory function to create SearchInput
 */
export function createSearchInput(
	container: HTMLElement,
	props: SearchInputProps
): SearchInput {
	const component = new SearchInput(container, props);
	component.render();
	return component;
}
