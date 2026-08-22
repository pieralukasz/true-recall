import { Rating } from "ts-fsrs";

import type { ReviewKeybindings } from "@true-recall/core/types";

import type { ReviewApi } from "@true-recall/obsidian/store";

/** `e.key` produced by Shift+1 on US and Polish layouts. */
const DELETE_CARD_KEY = "!";
/** `e.key` produced by Shift+2 on US and Polish layouts. */
const SUSPEND_CARD_KEY = "@";

interface KeyboardActionCallbacks {
	onShowAnswer: () => void;
	onAnswer: (rating: Rating) => void;
	onUndo: () => Promise<void>;
	onDelete: () => void;
	onSuspend: () => void;
	onForget: () => void;
	onBuryCard: () => void;
	onBuryNote: () => void;
	onMoveCard: () => Promise<void>;
	onAddCard: () => Promise<void>;
	onAddCardCopy: () => Promise<void>;
	onEditCard: () => Promise<void>;
	onEditComment: () => Promise<void>;
	onCycleTypeInMode: () => void;
	canRateShortcuts?: () => boolean;
	isTypeInActive?: () => boolean;
	onFocusTypeIn?: () => void;
	getSuggestedRating?: () => Rating | null;
}

export class KeyboardHandler {
	private getReview: () => ReviewApi;
	private callbacks: KeyboardActionCallbacks;
	private keybindings: ReviewKeybindings;

	constructor(
		getReview: () => ReviewApi,
		callbacks: KeyboardActionCallbacks,
		keybindings: ReviewKeybindings,
	) {
		this.getReview = getReview;
		this.callbacks = callbacks;
		this.keybindings = keybindings;
	}

	handleKeyDown = (e: KeyboardEvent): void => {
		if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
			e.preventDefault();
			e.stopPropagation();
			void this.callbacks.onAddCardCopy();
			return;
		}

		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			e.stopPropagation();
			void this.callbacks.onEditComment();
			return;
		}

		if (this.isInputFocused(e.target)) return;

		if (
			!e.shiftKey &&
			(e.metaKey || e.ctrlKey) &&
			e.key.toLowerCase() === "z"
		) {
			e.preventDefault();
			void this.callbacks.onUndo();
			return;
		}

		if (this.handleGlobalShortcuts(e)) return;
		this.handleSessionShortcuts(e);
	};

	private isInputFocused(target: EventTarget | null): boolean {
		if (target instanceof HTMLInputElement) return true;
		if (target instanceof HTMLTextAreaElement) return true;
		if (target instanceof HTMLElement && target.isContentEditable) return true;
		return false;
	}

	private handleGlobalShortcuts(e: KeyboardEvent): boolean {
		const key = e.key;

		if (e.shiftKey && key === DELETE_CARD_KEY) {
			e.preventDefault();
			void this.callbacks.onDelete();
			return true;
		}

		if (e.shiftKey && key === SUSPEND_CARD_KEY) {
			e.preventDefault();
			void this.callbacks.onSuspend();
			return true;
		}

		const handlers: Record<string, () => void> = {
			f: () => void this.callbacks.onForget(),
			F: () => void this.callbacks.onForget(),
			"-": () => void this.callbacks.onBuryCard(),
			"=": () => void this.callbacks.onBuryNote(),
			m: () => void this.callbacks.onMoveCard(),
			M: () => void this.callbacks.onMoveCard(),
			e: () => void this.callbacks.onEditCard(),
			E: () => void this.callbacks.onEditCard(),
			a: () => void this.callbacks.onAddCard(),
			A: () => void this.callbacks.onAddCard(),
			t: () => this.callbacks.onCycleTypeInMode(),
			T: () => this.callbacks.onCycleTypeInMode(),
		};

		const handler = handlers[key];
		if (handler) {
			e.preventDefault();
			handler();
			return true;
		}

		return false;
	}

	private isRevealKey(e: KeyboardEvent): boolean {
		const key = this.keybindings.revealAndGood;
		if (key === " ") return e.code === "Space" || e.key === " ";
		return e.key === key;
	}

	private handleSessionShortcuts(e: KeyboardEvent): void {
		const review = this.getReview();
		if (!review.isActive || review.isComplete()) return;

		if (!this.getReview().isAnswerRevealed) {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				this.callbacks.onShowAnswer();
				return;
			}

			if (this.isRevealKey(e)) {
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
				if (this.isRatingKey(e.key)) {
					e.preventDefault();
				}
				return;
			}

			// Plain Enter accepts the AI-suggested rating (type-in verdict).
			if (
				e.key === "Enter" &&
				!e.metaKey &&
				!e.ctrlKey &&
				!e.shiftKey &&
				!e.altKey
			) {
				const suggested = this.callbacks.getSuggestedRating?.() ?? null;
				if (suggested !== null) {
					e.preventDefault();
					void this.callbacks.onAnswer(suggested);
					return;
				}
			}

			const rating = this.buildRatingMap()[e.key];
			if (rating !== undefined) {
				e.preventDefault();
				void this.callbacks.onAnswer(rating);
			}
		}
	}

	private isRatingKey(key: string): boolean {
		return key in this.buildRatingMap();
	}

	private buildRatingMap(): Record<string, Rating> {
		const map: Record<string, Rating> = {
			"1": Rating.Again,
			"2": Rating.Hard,
			"3": Rating.Good,
			"4": Rating.Easy,
		};
		map[this.keybindings.revealAndGood] = Rating.Good;
		map[this.keybindings.again] = Rating.Again;
		map[this.keybindings.hard] = Rating.Hard;
		map[this.keybindings.easy] = Rating.Easy;
		return map;
	}

	// this: void tells TS this static method never needs a `this` context,
	// so extracting it into a plain function reference below is safe.
	static formatKeyName(this: void, key: string): string {
		if (key === " ") return "Space";
		if (key.length === 1) return key.toUpperCase();
		return key;
	}

	getShortcutsHelp(): Array<{ key: string; description: string }> {
		const fmt = KeyboardHandler.formatKeyName;
		return [
			{
				key: fmt(this.keybindings.revealAndGood),
				description: "Reveal / Good rating",
			},
			{ key: "Cmd/Ctrl+Enter", description: "Show answer (in input)" },
			{
				key: "1-4",
				description: "Rate: Again(1), Hard(2), Good(3), Easy(4)",
			},
			{ key: "Enter", description: "Accept suggested rating (type-in)" },
			{ key: "Cmd/Ctrl+Z", description: "Undo last action" },
			{ key: "Shift+1", description: "Delete card" },
			{ key: "Shift+2", description: "Suspend card" },
			{ key: "-", description: "Bury card until tomorrow" },
			{ key: "=", description: "Bury note (all sibling cards)" },
			{ key: "M", description: "Move card to another note" },
			{ key: "A", description: "Add new flashcard" },
			{ key: "E", description: "Edit card" },
			{
				key: "Cmd/Ctrl+Shift+E",
				description: "Copy current card into Add flashcard",
			},
			{ key: "Cmd/Ctrl+K", description: "Add or edit my note" },
			{ key: "T", description: "Toggle type-in mode" },
		];
	}
}
