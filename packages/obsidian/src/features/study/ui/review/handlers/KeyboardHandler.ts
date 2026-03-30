/**
 * Keyboard Handler for ReviewView
 * Centralizes keyboard shortcut handling for review sessions
 */

import type { ReviewApi } from "@true-recall/obsidian/store";
import { Rating } from "ts-fsrs";

/**
 * Keyboard shortcut configuration
 */
export interface KeyboardShortcuts {
	showAnswer: string; // Space
	again: string; // 1
	hard: string; // 2
	good: string; // 3 or Space (when revealed)
	easy: string; // 4
	undo: string; // Cmd/Ctrl+Z
	suspend: string; // Shift+1 (!)
	buryCard: string; // -
	buryNote: string; // =
	moveCard: string; // M
	editCard: string; // E
}

/**
 * Callbacks for keyboard actions
 */
export interface KeyboardActionCallbacks {
	onShowAnswer: () => void;
	onAnswer: (rating: Rating) => void;
	onUndo: () => Promise<void>;
	onSuspend: () => void;
	onForget: () => void;
	onBuryCard: () => void;
	onBuryNote: () => void;
	onMoveCard: () => Promise<void>;
	onAddCard: () => Promise<void>;
	onEditCard: () => Promise<void>;
	onCycleTypeInMode: () => void;
	canRateShortcuts?: () => boolean;
	isTypeInActive?: () => boolean;
	onFocusTypeIn?: () => void;
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
	private getReview: () => ReviewApi;
	private callbacks: KeyboardActionCallbacks;

	constructor(getReview: () => ReviewApi, callbacks: KeyboardActionCallbacks) {
		this.getReview = getReview;
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
		if (
			typeof HTMLInputElement !== "undefined" &&
			target instanceof HTMLInputElement
		) {
			return true;
		}
		if (
			typeof HTMLTextAreaElement !== "undefined" &&
			target instanceof HTMLTextAreaElement
		) {
			return true;
		}
		if (
			typeof HTMLElement !== "undefined" &&
			target instanceof HTMLElement &&
			target.isContentEditable
		) {
			return true;
		}
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

		// F = Forget card (reset to New + clear history)
		if (e.key === "f" || e.key === "F") {
			e.preventDefault();
			void this.callbacks.onForget();
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

		// E = Edit current card (modal)
		if (e.key === "e" || e.key === "E") {
			e.preventDefault();
			void this.callbacks.onEditCard();
			return true;
		}

		// A = Add new flashcard
		if (e.key === "a" || e.key === "A") {
			e.preventDefault();
			void this.callbacks.onAddCard();
			return true;
		}

		// T = Cycle type-in mode (off -> AI -> Diff -> off)
		if (e.key === "t" || e.key === "T") {
			e.preventDefault();
			this.callbacks.onCycleTypeInMode();
			return true;
		}

		return false;
	}

	/**
	 * Handle session-specific shortcuts (answer reveal, ratings)
	 */
	private handleSessionShortcuts(e: KeyboardEvent): void {
		const review = this.getReview();
		if (!review.isActive || review.isComplete()) return;

		if (!this.getReview().isAnswerRevealed) {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				this.callbacks.onShowAnswer();
				return;
			}

			// When type-in is active, Space focuses the editor instead of revealing
			if (e.code === "Space") {
				e.preventDefault();
				if (this.callbacks.isTypeInActive?.()) {
					this.callbacks.onFocusTypeIn?.();
				} else {
					this.callbacks.onShowAnswer();
				}
			}
		} else {
			const canRate = this.callbacks.canRateShortcuts?.() ?? true;
			if (!canRate) {
				if (["1", "2", "3", "4", " "].includes(e.key)) {
					e.preventDefault();
				}
				return;
			}

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
			{ key: "Space", description: "Reveal / Good rating" },
			{ key: "Cmd/Ctrl+Enter", description: "Show answer (in input)" },
			{ key: "1-4", description: "Rate: Again(1), Hard(2), Good(3), Easy(4)" },
			{ key: "Cmd/Ctrl+Z", description: "Undo last action" },
			{ key: "!", description: "Suspend card" },
			{ key: "-", description: "Bury card until tomorrow" },
			{ key: "=", description: "Bury note (all sibling cards)" },
			{ key: "M", description: "Move card to another note" },
			{ key: "A", description: "Add new flashcard" },
			{ key: "E", description: "Edit card" },
			{ key: "T", description: "Cycle type-in mode" },
		];
	}
}
