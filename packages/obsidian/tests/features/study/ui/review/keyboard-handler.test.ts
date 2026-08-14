import { Rating } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import type { ReviewKeybindings } from "@true-recall/core/types";

import { KeyboardHandler } from "../../../../../src/features/study/ui/review/handlers/KeyboardHandler";
import type { ReviewApi } from "../../../../../src/store";

// Stub DOM globals for Node test environment
globalThis.HTMLInputElement ??= class {} as never;
globalThis.HTMLTextAreaElement ??= class {} as never;
globalThis.HTMLElement ??= class {
	isContentEditable = false;
} as never;

const DEFAULT_KEYBINDINGS: ReviewKeybindings = {
	revealAndGood: " ",
	again: "1",
	hard: "2",
	easy: "4",
};

function createReviewState(
	overrides: Partial<Pick<ReviewApi, "isActive" | "isAnswerRevealed">> = {},
): ReviewApi {
	return {
		isActive: true,
		isAnswerRevealed: false,
		isComplete: () => false,
		...overrides,
	} as ReviewApi;
}

function createEvent(
	overrides: Partial<KeyboardEvent> & {
		key: string;
		code?: string;
	} = { key: "" },
): KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> } {
	return {
		key: "",
		code: "",
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		target: null,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
		...overrides,
	} as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

function defaultCallbacks(overrides = {}) {
	return {
		onShowAnswer: vi.fn(),
		onAnswer: vi.fn(async () => {}),
		onUndo: vi.fn(async () => {}),
		onDelete: vi.fn(),
		onSuspend: vi.fn(async () => {}),
		onBuryCard: vi.fn(async () => {}),
		onBuryNote: vi.fn(async () => {}),
		onMoveCard: vi.fn(async () => {}),
		onAddCard: vi.fn(async () => {}),
		onEditCard: vi.fn(async () => {}),
		onEditComment: vi.fn(async () => {}),
		onCycleTypeInMode: vi.fn(),
		...overrides,
	};
}

describe("KeyboardHandler", () => {
	it("opens the note editor on Cmd/Ctrl+K even from editable card content", () => {
		const onEditComment = vi.fn(async () => {});
		const target = new HTMLElement();
		target.isContentEditable = true;
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onEditComment }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "k", metaKey: true, target });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(event.stopPropagation).toHaveBeenCalledOnce();
		expect(onEditComment).toHaveBeenCalledOnce();
	});

	it("triggers plain reveal on Space before answer is revealed", () => {
		const onShowAnswer = vi.fn();
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onShowAnswer }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: " ", code: "Space" });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onShowAnswer).toHaveBeenCalledOnce();
	});

	it("triggers show answer on Cmd/Ctrl+Enter before reveal", () => {
		const onShowAnswer = vi.fn();
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onShowAnswer }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "Enter", ctrlKey: true });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onShowAnswer).toHaveBeenCalledOnce();
	});

	it("deletes the current card on Shift+1", () => {
		const onDelete = vi.fn();
		const onSuspend = vi.fn();
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onDelete, onSuspend }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "!", shiftKey: true });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onDelete).toHaveBeenCalledOnce();
		expect(onSuspend).not.toHaveBeenCalled();
	});

	it("suspends the current card on Shift+2", () => {
		const onDelete = vi.fn();
		const onSuspend = vi.fn();
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onDelete, onSuspend }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "@", shiftKey: true });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onSuspend).toHaveBeenCalledOnce();
		expect(onDelete).not.toHaveBeenCalled();
	});

	it("ignores the delete shortcut while an input is focused", () => {
		const onDelete = vi.fn();
		const target = new HTMLElement();
		target.isContentEditable = true;
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onDelete }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "!", shiftKey: true, target });
		handler.handleKeyDown(event);

		expect(onDelete).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	it("does not delete on a bare 1 keypress", () => {
		const onDelete = vi.fn();
		const handler = new KeyboardHandler(
			() => createReviewState({ isAnswerRevealed: true }),
			defaultCallbacks({ onDelete }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "1" });
		handler.handleKeyDown(event);

		expect(onDelete).not.toHaveBeenCalled();
	});

	it("cycles type-in mode with T", () => {
		const onCycleTypeInMode = vi.fn();
		const handler = new KeyboardHandler(
			() => createReviewState(),
			defaultCallbacks({ onCycleTypeInMode }),
			DEFAULT_KEYBINDINGS,
		);

		const event = createEvent({ key: "t" });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onCycleTypeInMode).toHaveBeenCalledOnce();
	});

	it("blocks 1-4 shortcuts only while ratings are locked", () => {
		const onAnswer = vi.fn(async () => {});
		const handler = new KeyboardHandler(
			() => createReviewState({ isAnswerRevealed: true }),
			defaultCallbacks({ onAnswer, canRateShortcuts: () => false }),
			DEFAULT_KEYBINDINGS,
		);

		const lockedEvent = createEvent({ key: "1" });
		handler.handleKeyDown(lockedEvent);
		expect(lockedEvent.preventDefault).toHaveBeenCalledOnce();
		expect(onAnswer).not.toHaveBeenCalled();

		const unlockedHandler = new KeyboardHandler(
			() => createReviewState({ isAnswerRevealed: true }),
			defaultCallbacks({ onAnswer, canRateShortcuts: () => true }),
			DEFAULT_KEYBINDINGS,
		);

		const unlockedEvent = createEvent({ key: "1" });
		unlockedHandler.handleKeyDown(unlockedEvent);
		expect(unlockedEvent.preventDefault).toHaveBeenCalledOnce();
		expect(onAnswer).toHaveBeenCalledWith(Rating.Again);
	});

	describe("custom keybindings", () => {
		it("uses custom reveal key (Enter) to show answer", () => {
			const onShowAnswer = vi.fn();
			const handler = new KeyboardHandler(
				() => createReviewState(),
				defaultCallbacks({ onShowAnswer }),
				{ ...DEFAULT_KEYBINDINGS, revealAndGood: "Enter" },
			);

			const event = createEvent({ key: "Enter" });
			handler.handleKeyDown(event);

			expect(event.preventDefault).toHaveBeenCalledOnce();
			expect(onShowAnswer).toHaveBeenCalledOnce();
		});

		it("uses custom reveal key to rate Good when answer is shown", () => {
			const onAnswer = vi.fn(async () => {});
			const handler = new KeyboardHandler(
				() => createReviewState({ isAnswerRevealed: true }),
				defaultCallbacks({ onAnswer }),
				{ ...DEFAULT_KEYBINDINGS, revealAndGood: "Enter" },
			);

			const event = createEvent({ key: "Enter" });
			handler.handleKeyDown(event);

			expect(onAnswer).toHaveBeenCalledWith(Rating.Good);
		});

		it("1-4 fallbacks still work when custom keys are set", () => {
			const onAnswer = vi.fn(async () => {});
			const handler = new KeyboardHandler(
				() => createReviewState({ isAnswerRevealed: true }),
				defaultCallbacks({ onAnswer }),
				{
					revealAndGood: "Enter",
					again: "q",
					hard: "w",
					easy: "p",
				},
			);

			handler.handleKeyDown(createEvent({ key: "1" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Again);

			handler.handleKeyDown(createEvent({ key: "2" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Hard);

			handler.handleKeyDown(createEvent({ key: "3" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Good);

			handler.handleKeyDown(createEvent({ key: "4" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Easy);
		});

		it("custom rating keys work alongside fallbacks", () => {
			const onAnswer = vi.fn(async () => {});
			const handler = new KeyboardHandler(
				() => createReviewState({ isAnswerRevealed: true }),
				defaultCallbacks({ onAnswer }),
				{
					revealAndGood: "Enter",
					again: "q",
					hard: "w",
					easy: "p",
				},
			);

			handler.handleKeyDown(createEvent({ key: "q" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Again);

			handler.handleKeyDown(createEvent({ key: "w" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Hard);

			handler.handleKeyDown(createEvent({ key: "p" }));
			expect(onAnswer).toHaveBeenCalledWith(Rating.Easy);
		});
	});

	describe("formatKeyName", () => {
		it("formats space as Space", () => {
			expect(KeyboardHandler.formatKeyName(" ")).toBe("Space");
		});

		it("uppercases single characters", () => {
			expect(KeyboardHandler.formatKeyName("a")).toBe("A");
		});

		it("preserves multi-character key names", () => {
			expect(KeyboardHandler.formatKeyName("Enter")).toBe("Enter");
		});
	});
});
