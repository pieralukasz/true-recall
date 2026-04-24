import { Rating } from "ts-fsrs";

import type { ReviewKeybindings } from "@true-recall/core/types";

import type { ReviewApi } from "@true-recall/obsidian/store";

interface KeyboardActionCallbacks {
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
		if (this.isInputFocused(e.target)) return;

		if ((e.metaKey || e.ctrlKey) && e.key === "z") {
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

		if (e.shiftKey && key === "!") {
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

	static formatKeyName(key: string): string {
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
