/**
 * SuggestionPopup
 * UI component for displaying autocomplete suggestions
 */
import type { NoteSuggestion } from "./autocomplete.types";

export class SuggestionPopup {
	private containerEl: HTMLElement;
	private listEl: HTMLElement;
	private suggestions: NoteSuggestion[] = [];
	private selectedIndex = 0;
	private onSelect: ((suggestion: NoteSuggestion) => void) | null = null;

	constructor() {
		// Create popup container
		this.containerEl = document.createElement("div");
		this.containerEl.classList.add("episteme-autocomplete-popup");
		this.containerEl.classList.add("is-hidden");

		// Create list element
		this.listEl = document.createElement("div");
		this.listEl.classList.add("episteme-autocomplete-list");
		this.containerEl.appendChild(this.listEl);
	}

	/**
	 * Attach popup to DOM
	 */
	attach(parent: HTMLElement): void {
		// Use absolute positioning when inside a modal, fixed otherwise
		const isInModal = parent.classList.contains("modal");
		if (isInModal) {
			this.containerEl.classList.add("is-in-modal");
		}
		parent.appendChild(this.containerEl);
	}

	/**
	 * Detach popup from DOM
	 */
	detach(): void {
		this.containerEl.remove();
	}

	/**
	 * Show popup with suggestions at specified position
	 */
	show(
		suggestions: NoteSuggestion[],
		position: { top: number; left: number },
		onSelect: (suggestion: NoteSuggestion) => void
	): void {
		this.suggestions = suggestions;
		this.selectedIndex = 0;
		this.onSelect = onSelect;

		if (suggestions.length === 0) {
			this.hide();
			return;
		}

		// Clear and rebuild list
		this.listEl.innerHTML = "";

		suggestions.forEach((suggestion, i) => {
			const item = document.createElement("div");
			item.classList.add("episteme-autocomplete-item");
			if (i === 0) {
				item.classList.add("is-selected");
			}

			// Note name
			const nameEl = document.createElement("span");
			nameEl.classList.add("episteme-autocomplete-name");
			nameEl.textContent = suggestion.noteBasename;
			item.appendChild(nameEl);

			// Alias badge if matched via alias
			if (suggestion.matchType === "alias") {
				const badge = document.createElement("span");
				badge.classList.add("episteme-autocomplete-alias-badge");
				badge.textContent = suggestion.matchedText;
				item.appendChild(badge);
			}

			// Click handler
			item.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.selectSuggestion(i);
			});

			// Mouse enter for selection
			item.addEventListener("mouseenter", () => {
				this.setSelectedIndex(i);
			});

			this.listEl.appendChild(item);
		});

		// Position popup using CSS custom properties
		this.containerEl.style.setProperty("--popup-top", `${position.top}px`);
		this.containerEl.style.setProperty("--popup-left", `${position.left}px`);
		this.containerEl.classList.remove("is-hidden");
	}

	/**
	 * Hide popup
	 */
	hide(): void {
		this.containerEl.classList.add("is-hidden");
		this.suggestions = [];
		this.onSelect = null;
	}

	/**
	 * Check if popup is visible
	 */
	isVisible(): boolean {
		return !this.containerEl.classList.contains("is-hidden");
	}

	/**
	 * Move selection up
	 */
	moveUp(): void {
		if (this.suggestions.length === 0) return;
		const newIndex =
			this.selectedIndex > 0
				? this.selectedIndex - 1
				: this.suggestions.length - 1;
		this.setSelectedIndex(newIndex);
	}

	/**
	 * Move selection down
	 */
	moveDown(): void {
		if (this.suggestions.length === 0) return;
		const newIndex =
			this.selectedIndex < this.suggestions.length - 1
				? this.selectedIndex + 1
				: 0;
		this.setSelectedIndex(newIndex);
	}

	/**
	 * Get currently selected suggestion
	 */
	getSelectedSuggestion(): NoteSuggestion | null {
		return this.suggestions[this.selectedIndex] ?? null;
	}

	/**
	 * Select and confirm current suggestion
	 */
	confirmSelection(): void {
		const suggestion = this.getSelectedSuggestion();
		if (suggestion && this.onSelect) {
			this.onSelect(suggestion);
		}
		this.hide();
	}

	/**
	 * Set selected index and update visual state
	 */
	private setSelectedIndex(index: number): void {
		// Remove previous selection
		const items = this.listEl.querySelectorAll(".episteme-autocomplete-item");
		items.forEach((item) => item.classList.remove("is-selected"));

		// Add new selection
		this.selectedIndex = index;
		const selectedItem = items[index];
		if (selectedItem) {
			selectedItem.classList.add("is-selected");
			// Scroll into view if needed
			selectedItem.scrollIntoView({ block: "nearest" });
		}
	}

	/**
	 * Select suggestion at index
	 */
	private selectSuggestion(index: number): void {
		const suggestion = this.suggestions[index];
		if (suggestion && this.onSelect) {
			this.onSelect(suggestion);
		}
		this.hide();
	}
}
