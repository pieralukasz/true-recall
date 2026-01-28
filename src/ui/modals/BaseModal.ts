/**
 * Base Modal Component
 * Provides consistent styling and structure for all plugin modals
 */
import { App, Modal } from "obsidian";

export interface BaseModalOptions {
	title: string;
	width?: string; // e.g. "500px", defaults to "fit-content"
}

/**
 * Button configuration for renderButtons helper
 */
export interface ModalButton {
	text: string;
	type: "primary" | "secondary" | "danger";
	onClick: () => void;
	disabled?: boolean;
}

/**
 * List item configuration for renderListItem helper
 */
export interface ListItemConfig {
	icon?: string;
	name: string;
	description?: string;
	badge?: string;
}

/**
 * Selectable item configuration for renderSelectableItem helper
 */
export interface SelectableItemConfig extends ListItemConfig {
	selected: boolean;
	onToggle: (selected: boolean) => void;
}

/**
 * Abstract base class for plugin modals
 * Uses Obsidian's native titleEl for proper alignment with close button
 */
export abstract class BaseModal extends Modal {
	protected modalTitle: string;
	protected modalWidth: string;

	constructor(app: App, options: BaseModalOptions) {
		super(app);
		this.modalTitle = options.title;
		this.modalWidth = options.width ?? "fit-content";
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

	// ============================================================
	// Helper methods for common modal patterns
	// Use "create" prefix to avoid conflicts with existing private methods
	// ============================================================

	/**
	 * Create a standard button section with consistent styling
	 * @param container Parent element
	 * @param buttons Array of button configs
	 * @returns The buttons container element
	 */
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

			btnEl.addEventListener("click", btn.onClick);
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

		searchInput.addEventListener("input", (e) => {
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
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-secondary ep:px-1.5 ep:py-0.5 ep:rounded ep:ml-2",
				text: item.badge,
			});
		}

		// Select button
		const selectBtn = itemEl.createEl("button", {
			text: "Select",
			cls: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded ep:bg-obs-interactive ep:text-white ep:border-none ep:text-ui-smaller ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100",
		});

		selectBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			onSelect();
		});

		// Row click also selects
		itemEl.addEventListener("click", () => onSelect());

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

		checkbox.addEventListener("change", () => {
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
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-secondary ep:px-1.5 ep:py-0.5 ep:rounded ep:ml-2",
				text: item.badge,
			});
		}

		// Row click toggles checkbox
		itemEl.addEventListener("click", (e) => {
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
				item.onToggle(checkbox.checked);
			}
		});

		return itemEl;
	}
}
