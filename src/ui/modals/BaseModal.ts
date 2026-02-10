import { App, Modal } from "obsidian";

export interface BaseModalOptions {
	title: string;
	width?: string; // e.g. "500px", defaults to "fit-content"
}

export interface ModalButton {
	text: string;
	type: "primary" | "secondary" | "danger";
	onClick: () => void;
	disabled?: boolean;
}

export interface ListItemConfig {
	icon?: string;
	name: string;
	description?: string;
	badge?: string;
}

export interface SelectableItemConfig extends ListItemConfig {
	selected: boolean;
	onToggle: (selected: boolean) => void;
}

interface RegisteredEvent {
	el: HTMLElement;
	type: string;
	handler: EventListener;
}

export abstract class BaseModal extends Modal {
	protected modalTitle: string;
	protected modalWidth: string;
	private registeredEvents: RegisteredEvent[] = [];

	constructor(app: App, options: BaseModalOptions) {
		super(app);
		this.modalTitle = options.title;
		this.modalWidth = options.width ?? "fit-content";
	}

	/**
	 * Register a DOM event listener that will be automatically removed on modal close
	 */
	protected addDomEvent<K extends keyof HTMLElementEventMap>(
		el: HTMLElement,
		type: K,
		handler: (ev: HTMLElementEventMap[K]) => void
	): void {
		el.addEventListener(type, handler as EventListener);
		this.registeredEvents.push({ el, type, handler: handler as EventListener });
	}

	onClose(): void {
		// Clean up all registered event listeners
		for (const { el, type, handler } of this.registeredEvents) {
			el.removeEventListener(type, handler);
		}
		this.registeredEvents = [];
	}

	onOpen(): void {
		const { contentEl, modalEl, titleEl } = this;
		contentEl.empty();

		// Add base class (keep for CSS selectors that need :has() targeting)
		contentEl.addClass("true-recall-modal");

		// Set width on .modal container
		modalEl.style.width = this.modalWidth;

		// Use Obsidian's native titleEl (aligned with close button)
		titleEl.setText(this.modalTitle);

		// Render body content (implemented by subclasses)
		const bodyEl = contentEl.createDiv({
			cls: "ep:py-2.5 ep:px-3",
		});
		this.renderBody(bodyEl);
	}

	/**
	 * Update the modal title dynamically
	 */
	protected updateTitle(newTitle: string): void {
		this.modalTitle = newTitle;
		this.titleEl.setText(newTitle);
	}

	/**
	 * Render the modal body content
	 * Must be implemented by subclasses
	 */
	protected abstract renderBody(container: HTMLElement): void;

	protected createButtonsSection(
		container: HTMLElement,
		buttons: ModalButton[]
	): HTMLElement {
		const buttonsEl = container.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border",
		});

		for (const btn of buttons) {
			const btnEl = buttonsEl.createEl("button", {
				text: btn.text,
				cls: this.getButtonClass(btn.type),
			});

			if (btn.disabled) {
				btnEl.disabled = true;
				btnEl.addClass("ep:opacity-50", "ep:cursor-not-allowed");
			}

			// Use addDomEvent for automatic cleanup on modal close
			this.addDomEvent(btnEl, "click", btn.onClick);
		}

		return buttonsEl;
	}

	/**
	 * Get CSS classes for button type
	 */
	private getButtonClass(type: ModalButton["type"]): string {
		const base =
			"ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all";

		switch (type) {
			case "primary":
				return `mod-cta ${base}`;
			case "danger":
				return `mod-warning ${base}`;
			case "secondary":
			default:
				return `${base} ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover`;
		}
	}

	/**
	 * Create a search input with auto-focus
	 * @param container Parent element
	 * @param placeholder Placeholder text
	 * @param onInput Callback when input changes
	 * @returns The input element
	 */
	protected createSearchInput(
		container: HTMLElement,
		placeholder: string,
		onInput: (query: string) => void
	): HTMLInputElement {
		const searchContainer = container.createDiv({ cls: "ep:mb-3" });

		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder,
			cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
		});

		// Use addDomEvent for automatic cleanup on modal close
		this.addDomEvent(searchInput, "input", (e: Event) => {
			onInput((e.target as HTMLInputElement).value.toLowerCase());
		});

		// Auto-focus
		setTimeout(() => searchInput.focus(), 50);

		return searchInput;
	}

	/**
	 * Create an empty state message
	 * @param container Parent element
	 * @param message Message to display
	 * @returns The empty state element
	 */
	protected createEmptyState(
		container: HTMLElement,
		message: string
	): HTMLElement {
		return container.createDiv({
			text: message,
			cls: "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic",
		});
	}

	/**
	 * Create a scrollable list container
	 * @param container Parent element
	 * @param maxHeight Max height (default 350px)
	 * @returns The list container element
	 */
	protected createListContainer(
		container: HTMLElement,
		maxHeight = "350px"
	): HTMLElement {
		return container.createDiv({
			cls: `ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto`,
			attr: { style: `max-height: ${maxHeight}` },
		});
	}

	/**
	 * Create a list item (file/note style)
	 * @param container Parent element (usually list container)
	 * @param item Item configuration
	 * @param onSelect Callback when item is selected
	 * @returns The item element
	 */
	protected createListItem(
		container: HTMLElement,
		item: ListItemConfig,
		onSelect: () => void
	): HTMLElement {
		const itemEl = container.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group",
		});

		// Icon and name
		const infoEl = itemEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1",
		});
		infoEl.createSpan({
			cls: "ep:shrink-0",
			text: item.icon ?? "📄",
		});
		infoEl.createSpan({
			cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
			text: item.name,
		});

		// Description (e.g., folder path)
		if (item.description) {
			infoEl.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2",
				text: item.description,
			});
		}

		// Badge (optional)
		if (item.badge) {
			infoEl.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-secondary ep:px-2 ep:py-1 ep:rounded ep:ml-2",
				text: item.badge,
			});
		}

		// Select button
		const selectBtn = itemEl.createEl("button", {
			text: "Select",
			cls: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-smaller ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100",
		});

		// Use addDomEvent for automatic cleanup on modal close
		this.addDomEvent(selectBtn, "click", (e: MouseEvent) => {
			e.stopPropagation();
			onSelect();
		});

		// Row click also selects
		this.addDomEvent(itemEl, "click", () => onSelect());

		return itemEl;
	}

	/**
	 * Create a selectable item with checkbox
	 * @param container Parent element
	 * @param item Item configuration with selection state
	 * @returns The item element
	 */
	protected createSelectableItem(
		container: HTMLElement,
		item: SelectableItemConfig
	): HTMLElement {
		const itemEl = container.createDiv({
			cls: "ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0",
		});

		// Checkbox
		const checkbox = itemEl.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0",
		});
		checkbox.checked = item.selected;

		// Use addDomEvent for automatic cleanup on modal close
		this.addDomEvent(checkbox, "change", () => {
			item.onToggle(checkbox.checked);
		});

		// Icon and name
		const infoEl = itemEl.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1",
		});
		infoEl.createSpan({
			cls: "ep:shrink-0",
			text: item.icon ?? "📄",
		});
		infoEl.createSpan({
			cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
			text: item.name,
		});

		// Description
		if (item.description) {
			infoEl.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:ml-2",
				text: item.description,
			});
		}

		// Badge
		if (item.badge) {
			infoEl.createSpan({
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-secondary ep:px-2 ep:py-1 ep:rounded ep:ml-2",
				text: item.badge,
			});
		}

		// Row click toggles checkbox
		this.addDomEvent(itemEl, "click", (e: MouseEvent) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
				item.onToggle(checkbox.checked);
			}
		});

		return itemEl;
	}
}
