/**
 * TextareaSuggest
 * Main controller that connects textarea input to autocomplete suggestions
 */
import type {
	CursorContext,
	NoteSuggestion,
	TextareaSuggestOptions,
} from "./autocomplete.types";
import { SuggestionPopup } from "./SuggestionPopup";
import type { VaultSearchService } from "./VaultSearchService";

const DEFAULT_OPTIONS: Required<TextareaSuggestOptions> = {
	minChars: 2,
	maxSuggestions: 8,
	debounceMs: 150,
};

export class TextareaSuggest {
	private textarea: HTMLTextAreaElement;
	private searchService: VaultSearchService;
	private popup: SuggestionPopup;
	private options: Required<TextareaSuggestOptions>;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private currentContext: CursorContext | null = null;

	// Bound event handlers for cleanup
	private boundInputHandler: (e: Event) => void;
	private boundKeydownHandler: (e: KeyboardEvent) => void;
	private boundBlurHandler: () => void;

	constructor(
		textarea: HTMLTextAreaElement,
		searchService: VaultSearchService,
		options: TextareaSuggestOptions = {}
	) {
		this.textarea = textarea;
		this.searchService = searchService;
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.popup = new SuggestionPopup();

		// Bind handlers
		this.boundInputHandler = this.handleInput.bind(this);
		this.boundKeydownHandler = this.handleKeydown.bind(this);
		this.boundBlurHandler = this.handleBlur.bind(this);

		this.attach();
	}

	/**
	 * Attach event listeners and popup to DOM
	 */
	private attach(): void {
		this.textarea.addEventListener("input", this.boundInputHandler);
		this.textarea.addEventListener("keydown", this.boundKeydownHandler);
		this.textarea.addEventListener("blur", this.boundBlurHandler);

		// Always attach popup to document.body with position:fixed
		// This avoids overflow:hidden clipping issues in modals
		this.popup.attach(document.body);
	}

	/**
	 * Detach and cleanup
	 */
	destroy(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.textarea.removeEventListener("input", this.boundInputHandler);
		this.textarea.removeEventListener("keydown", this.boundKeydownHandler);
		this.textarea.removeEventListener("blur", this.boundBlurHandler);

		this.popup.detach();
	}

	/**
	 * Handle textarea input (debounced)
	 */
	private handleInput(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.updateSuggestions();
		}, this.options.debounceMs);
	}

	/**
	 * Handle keydown events
	 */
	private handleKeydown(e: KeyboardEvent): void {
		if (!this.popup.isVisible()) {
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				e.stopPropagation();
				this.popup.moveDown();
				break;

			case "ArrowUp":
				e.preventDefault();
				e.stopPropagation();
				this.popup.moveUp();
				break;

			case "Enter":
			case "Tab":
				e.preventDefault();
				e.stopPropagation();
				this.popup.confirmSelection();
				break;

			case "Escape":
				e.preventDefault();
				e.stopPropagation();
				this.popup.hide();
				break;
		}
	}

	/**
	 * Handle blur - hide popup with small delay to allow click
	 */
	private handleBlur(): void {
		// Delay hiding to allow click events to fire
		setTimeout(() => {
			this.popup.hide();
		}, 150);
	}

	/**
	 * Update suggestions based on current cursor position
	 */
	private updateSuggestions(): void {
		const context = this.getCursorContext();

		if (!context || context.word.length < this.options.minChars) {
			this.popup.hide();
			this.currentContext = null;
			return;
		}

		this.currentContext = context;

		// Search for suggestions
		const suggestions = this.searchService.search(
			context.word,
			this.options.maxSuggestions
		);

		if (suggestions.length === 0) {
			this.popup.hide();
			return;
		}

		// Calculate popup position
		const position = this.calculatePopupPosition();

		// Show popup
		this.popup.show(suggestions, position, (suggestion) => {
			this.insertSuggestion(suggestion);
		});
	}

	/**
	 * Get the word context at the current cursor position
	 */
	private getCursorContext(): CursorContext | null {
		const value = this.textarea.value;
		const cursorPos = this.textarea.selectionStart;

		// Find word boundaries (whitespace, brackets, pipe)
		const wordBoundaryPattern = /[\s[\]|]/;

		// Scan backwards to find word start
		let startIndex = cursorPos;
		while (startIndex > 0) {
			const char = value.charAt(startIndex - 1);
			if (wordBoundaryPattern.test(char)) break;
			startIndex--;
		}

		// Scan forwards to find word end
		let endIndex = cursorPos;
		while (endIndex < value.length) {
			const char = value.charAt(endIndex);
			if (wordBoundaryPattern.test(char)) break;
			endIndex++;
		}

		const word = value.substring(startIndex, endIndex);

		if (!word) {
			return null;
		}

		return {
			word,
			startIndex,
			endIndex,
		};
	}

	/**
	 * Check if cursor is inside a wiki link [[ ... ]]
	 */
	private isCursorInsideLink(): boolean {
		const value = this.textarea.value;
		const cursorPos = this.textarea.selectionStart;
		const beforeCursor = value.substring(0, cursorPos);

		const lastOpen = beforeCursor.lastIndexOf("[[");
		const lastClose = beforeCursor.lastIndexOf("]]");

		// If [[ appears after the last ]], we're inside a link
		return lastOpen > lastClose;
	}

	/**
	 * Calculate popup position relative to word start in viewport coordinates
	 */
	private calculatePopupPosition(): { top: number; left: number } {
		const textareaRect = this.textarea.getBoundingClientRect();

		// Create a hidden clone to measure cursor position
		const clone = document.createElement("div");
		clone.classList.add("episteme-autocomplete-measure-clone");

		// Apply computed styles via CSS properties
		const computedStyle = getComputedStyle(this.textarea);
		clone.style.setProperty("--clone-font-family", computedStyle.fontFamily);
		clone.style.setProperty("--clone-font-size", computedStyle.fontSize);
		clone.style.setProperty("--clone-line-height", computedStyle.lineHeight);
		clone.style.setProperty("--clone-padding", computedStyle.padding);
		clone.style.setProperty("--clone-width", `${this.textarea.clientWidth}px`);
		clone.style.setProperty("--clone-border", computedStyle.border);

		// Use word START position instead of cursor position for proper alignment
		const startIndex = this.currentContext?.startIndex ?? this.textarea.selectionStart;
		const textBeforeCursor = this.textarea.value.substring(0, startIndex);

		// Build DOM instead of using innerHTML
		const lines = textBeforeCursor.split("\n");
		lines.forEach((line, i) => {
			if (i > 0) {
				clone.appendChild(document.createElement("br"));
			}
			// Use textContent for each line (nbsp for spaces to preserve them)
			const lineText = line.replace(/ /g, "\u00A0"); // non-breaking space
			clone.appendChild(document.createTextNode(lineText));
		});

		// Add cursor marker
		const marker = document.createElement("span");
		marker.id = "cursor-marker";
		clone.appendChild(marker);

		document.body.appendChild(clone);

		const markerRect = marker.getBoundingClientRect();
		const cloneRect = clone.getBoundingClientRect();

		// Calculate cursor position in viewport
		const cursorLeftInViewport =
			textareaRect.left + (markerRect.left - cloneRect.left);

		const linesBeforeCursor = textBeforeCursor.split("\n").length;
		const lineHeight = parseFloat(computedStyle.lineHeight);
		const scrollTop = this.textarea.scrollTop;

		let cursorTopInViewport =
			textareaRect.top +
			linesBeforeCursor * lineHeight -
			scrollTop +
			lineHeight +
			4;

		// Ensure popup stays within viewport
		const viewportHeight = window.innerHeight;
		const popupHeight = 300; // estimated
		if (cursorTopInViewport + popupHeight > viewportHeight) {
			// Position above cursor instead
			cursorTopInViewport =
				textareaRect.top +
				(linesBeforeCursor - 1) * lineHeight -
				scrollTop -
				popupHeight -
				4;
		}

		document.body.removeChild(clone);

		// Ensure left position doesn't go off screen
		const viewportWidth = window.innerWidth;
		const popupWidth = 280; // estimated

		let left = cursorLeftInViewport;
		let top = cursorTopInViewport;

		if (left + popupWidth > viewportWidth) {
			left = viewportWidth - popupWidth - 10;
		}

		return { top, left };
	}

	/**
	 * Insert selected suggestion into textarea
	 */
	private insertSuggestion(suggestion: NoteSuggestion): void {
		if (!this.currentContext) return;

		const { startIndex, endIndex } = this.currentContext;
		const value = this.textarea.value;

		const isInsideLink = this.isCursorInsideLink();

		let insertText: string;
		if (isInsideLink) {
			// Inside link - insert just the reference
			if (suggestion.matchType === "alias") {
				insertText = `${suggestion.noteBasename}|${suggestion.matchedText}`;
			} else {
				insertText = suggestion.noteBasename;
			}
		} else {
			// Outside link - wrap in [[]]
			if (suggestion.matchType === "alias") {
				insertText = `[[${suggestion.noteBasename}|${suggestion.matchedText}]]`;
			} else {
				insertText = `[[${suggestion.noteBasename}]]`;
			}
		}

		// Replace the word with the link or note name
		const newValue =
			value.substring(0, startIndex) + insertText + value.substring(endIndex);

		this.textarea.value = newValue;

		// Set cursor position after the inserted text
		const newCursorPos = startIndex + insertText.length;
		this.textarea.setSelectionRange(newCursorPos, newCursorPos);

		// Trigger input event so other handlers can react
		this.textarea.dispatchEvent(new Event("input", { bubbles: true }));

		// Focus textarea
		this.textarea.focus();

		this.currentContext = null;
	}
}
