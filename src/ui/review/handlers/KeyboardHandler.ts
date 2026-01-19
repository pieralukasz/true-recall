/**
 * Keyboard Handler for ReviewView
 * Centralizes keyboard shortcut handling for review sessions
 */
import { Rating } from "ts-fsrs";
import type { ReviewStateManager } from "../../../state";

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcuts {
	showAnswer: string;        // Space
	again: string;             // 1
	hard: string;              // 2
	good: string;              // 3 or Space (when revealed)
	easy: string;              // 4
	undo: string;              // Cmd/Ctrl+Z
	suspend: string;           // Shift+1 (!)
	buryCard: string;          // -
	buryNote: string;          // =
	moveCard: string;          // M
	addCard: string;           // N
	copyCard: string;          // B
	editCard: string;          // E
}

/**
 * Callbacks for keyboard actions
 */
export interface KeyboardActionCallbacks {
	onShowAnswer: () => void;
	onAnswer: (rating: Rating) => Promise<void>;
	onUndo: () => Promise<void>;
	onSuspend: () => Promise<void>;
	onBuryCard: () => Promise<void>;
	onBuryNote: () => Promise<void>;
	onMoveCard: () => Promise<void>;
	onAddCard: () => Promise<void>;
	onCopyCard: () => Promise<void>;
	onEditCard: () => Promise<void>;
}

/**
 * KeyboardHandler manages keyboard shortcuts for the review view
 *
 * Usage:
 * ```typescript
 * const handler = new KeyboardHandler(stateManager, callbacks);
 * document.addEventListener("keydown", handler.handleKeyDown);
 * ```
 */
export class KeyboardHandler {
	private stateManager: ReviewStateManager;
	private callbacks: KeyboardActionCallbacks;

	constructor(
		stateManager: ReviewStateManager,
		callbacks: KeyboardActionCallbacks
	) {
		this.stateManager = stateManager;
		this.callbacks = callbacks;
	}

	/**
	 * Handle keydown events
	 * Bound method for direct use as event listener
	 */
	handleKeyDown = (e: KeyboardEvent): void => {
		// Ignore if typing in input/textarea or contenteditable
		if (this.isInputFocused(e.target)) {
			return;
		}

		// Cmd+Z (Mac) or Ctrl+Z (Windows/Linux) for undo
		if ((e.metaKey || e.ctrlKey) && e.key === "z") {
			e.preventDefault();
			void this.callbacks.onUndo();
			return;
		}

		// Global shortcuts (work regardless of session state)
		if (this.handleGlobalShortcuts(e)) {
			return;
		}

		// Session-specific shortcuts
		this.handleSessionShortcuts(e);
	};

	/**
	 * Check if an input element is focused
	 */
	private isInputFocused(target: EventTarget | null): boolean {
		if (target instanceof HTMLInputElement) return true;
		if (target instanceof HTMLTextAreaElement) return true;
		if (target instanceof HTMLElement && target.isContentEditable) return true;
		return false;
	}

	/**
	 * Handle global shortcuts that work regardless of session state
	 */
	private handleGlobalShortcuts(e: KeyboardEvent): boolean {
		// Shift+1 = Suspend card
		if (e.shiftKey && e.key === "!") {
			e.preventDefault();
			void this.callbacks.onSuspend();
			return true;
		}

		// - (minus) = Bury card until tomorrow
		if (e.key === "-") {
			e.preventDefault();
			void this.callbacks.onBuryCard();
			return true;
		}

		// = (equals) = Bury note (all cards from same source) until tomorrow
		if (e.key === "=") {
			e.preventDefault();
			void this.callbacks.onBuryNote();
			return true;
		}

		// M = Move card to another note
		if (e.key === "m" || e.key === "M") {
			e.preventDefault();
			void this.callbacks.onMoveCard();
			return true;
		}

		// N = Add new flashcard
		if (e.key === "n" || e.key === "N") {
			e.preventDefault();
			void this.callbacks.onAddCard();
			return true;
		}

		// B = Copy current card to new flashcard
		if (e.key === "b" || e.key === "B") {
			e.preventDefault();
			void this.callbacks.onCopyCard();
			return true;
		}

		// E = Edit current card (modal)
		if (e.key === "e" || e.key === "E") {
			e.preventDefault();
			void this.callbacks.onEditCard();
			return true;
		}

		return false;
	}

	/**
	 * Handle session-specific shortcuts (answer reveal, ratings)
	 */
	private handleSessionShortcuts(e: KeyboardEvent): void {
		const state = this.stateManager.getState();
		if (!state.isActive || this.stateManager.isComplete()) return;

		if (!this.stateManager.isAnswerRevealed()) {
			// Show answer on Space
			if (e.code === "Space") {
				e.preventDefault();
				this.callbacks.onShowAnswer();
			}
		} else {
			// Rating buttons: 1=Again, 2=Hard, 3=Good, 4=Easy
			switch (e.key) {
				case "1":
					e.preventDefault();
					void this.callbacks.onAnswer(Rating.Again);
					break;
				case "2":
					e.preventDefault();
					void this.callbacks.onAnswer(Rating.Hard);
					break;
				case "3":
				case " ": // Space bar also triggers Good
					e.preventDefault();
					void this.callbacks.onAnswer(Rating.Good);
					break;
				case "4":
					e.preventDefault();
					void this.callbacks.onAnswer(Rating.Easy);
					break;
			}
		}
	}

	/**
	 * Get keyboard shortcuts help text
	 */
	static getShortcutsHelp(): Array<{ key: string; description: string }> {
		return [
			{ key: "Space", description: "Show answer / Good rating" },
			{ key: "1-4", description: "Rate: Again(1), Hard(2), Good(3), Easy(4)" },
			{ key: "Cmd/Ctrl+Z", description: "Undo last action" },
			{ key: "!", description: "Suspend card" },
			{ key: "-", description: "Bury card until tomorrow" },
			{ key: "=", description: "Bury note (all sibling cards)" },
			{ key: "M", description: "Move card to another note" },
			{ key: "N", description: "Add new flashcard" },
			{ key: "B", description: "Copy card (branch)" },
			{ key: "E", description: "Edit card" },
		];
	}
}
