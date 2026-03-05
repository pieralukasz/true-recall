import { describe, expect, it, vi } from "vitest";
import { KeyboardHandler } from "../../../src/features/study/ui/review/handlers/KeyboardHandler";
import { Rating } from "ts-fsrs";
import type { ReviewApi } from "../../../src/shared/store";

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
		...overrides,
	} as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("KeyboardHandler", () => {
	it("triggers plain reveal on Space before answer is revealed", () => {
		const onShowAnswer = vi.fn();
		const handler = new KeyboardHandler(() => createReviewState(), {
			onShowAnswer,
			onRevealWithAI: vi.fn(),
			onAnswer: vi.fn(async () => {}),
			onUndo: vi.fn(async () => {}),
			onSuspend: vi.fn(async () => {}),
			onBuryCard: vi.fn(async () => {}),
			onBuryNote: vi.fn(async () => {}),
			onMoveCard: vi.fn(async () => {}),
			onAddCard: vi.fn(async () => {}),
			onEditCard: vi.fn(async () => {}),
			onToggleTypeInMode: vi.fn(),
		});

		const event = createEvent({ key: " ", code: "Space" });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onShowAnswer).toHaveBeenCalledOnce();
	});

	it("triggers AI reveal on Cmd/Ctrl+Enter before reveal", () => {
		const onRevealWithAI = vi.fn();
		const handler = new KeyboardHandler(() => createReviewState(), {
			onShowAnswer: vi.fn(),
			onRevealWithAI,
			onAnswer: vi.fn(async () => {}),
			onUndo: vi.fn(async () => {}),
			onSuspend: vi.fn(async () => {}),
			onBuryCard: vi.fn(async () => {}),
			onBuryNote: vi.fn(async () => {}),
			onMoveCard: vi.fn(async () => {}),
			onAddCard: vi.fn(async () => {}),
			onEditCard: vi.fn(async () => {}),
			onToggleTypeInMode: vi.fn(),
			canRevealWithAIShortcut: () => true,
		});

		const event = createEvent({ key: "Enter", ctrlKey: true });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onRevealWithAI).toHaveBeenCalledOnce();
	});

	it("toggles type-in mode with T", () => {
		const onToggleTypeInMode = vi.fn();
		const handler = new KeyboardHandler(() => createReviewState(), {
			onShowAnswer: vi.fn(),
			onRevealWithAI: vi.fn(),
			onAnswer: vi.fn(async () => {}),
			onUndo: vi.fn(async () => {}),
			onSuspend: vi.fn(async () => {}),
			onBuryCard: vi.fn(async () => {}),
			onBuryNote: vi.fn(async () => {}),
			onMoveCard: vi.fn(async () => {}),
			onAddCard: vi.fn(async () => {}),
			onEditCard: vi.fn(async () => {}),
			onToggleTypeInMode,
		});

		const event = createEvent({ key: "t" });
		handler.handleKeyDown(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(onToggleTypeInMode).toHaveBeenCalledOnce();
	});

	it("blocks 1-4 shortcuts only while ratings are locked", () => {
		const onAnswer = vi.fn(async () => {});
		const handler = new KeyboardHandler(
			() =>
				createReviewState({
					isAnswerRevealed: true,
				}),
			{
				onShowAnswer: vi.fn(),
				onRevealWithAI: vi.fn(),
				onAnswer,
				onUndo: vi.fn(async () => {}),
				onSuspend: vi.fn(async () => {}),
				onBuryCard: vi.fn(async () => {}),
				onBuryNote: vi.fn(async () => {}),
				onMoveCard: vi.fn(async () => {}),
				onAddCard: vi.fn(async () => {}),
				onEditCard: vi.fn(async () => {}),
				onToggleTypeInMode: vi.fn(),
				canRateShortcuts: () => false,
			},
		);

		const lockedEvent = createEvent({ key: "1" });
		handler.handleKeyDown(lockedEvent);
		expect(lockedEvent.preventDefault).toHaveBeenCalledOnce();
		expect(onAnswer).not.toHaveBeenCalled();

		const unlockedHandler = new KeyboardHandler(
			() =>
				createReviewState({
					isAnswerRevealed: true,
				}),
			{
				onShowAnswer: vi.fn(),
				onRevealWithAI: vi.fn(),
				onAnswer,
				onUndo: vi.fn(async () => {}),
				onSuspend: vi.fn(async () => {}),
				onBuryCard: vi.fn(async () => {}),
				onBuryNote: vi.fn(async () => {}),
				onMoveCard: vi.fn(async () => {}),
				onAddCard: vi.fn(async () => {}),
				onEditCard: vi.fn(async () => {}),
				onToggleTypeInMode: vi.fn(),
				canRateShortcuts: () => true,
			},
		);

		const unlockedEvent = createEvent({ key: "1" });
		unlockedHandler.handleKeyDown(unlockedEvent);
		expect(unlockedEvent.preventDefault).toHaveBeenCalledOnce();
		expect(onAnswer).toHaveBeenCalledWith(Rating.Again);
	});
});

