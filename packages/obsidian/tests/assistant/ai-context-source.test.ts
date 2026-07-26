import { describe, expect, it } from "vitest";

import {
	type AssistantContextCard,
	describeAssistantContext,
	isSameAssistantSubject,
	resolveAssistantContext,
} from "../../src/features/assistant/ui/ai-context-source";

const card = (overrides: Partial<AssistantContextCard> = {}) =>
	({
		id: "card-1",
		noteId: "note-1",
		question: "What is spacing effect?",
		answer: "Distributed practice beats massed practice.",
		sourceUid: "uid-1",
		sourceNotePath: "Learning/Memory.md",
		fsrs: { noteTypeId: "basic" },
		...overrides,
	}) as AssistantContextCard;

describe("resolveAssistantContext", () => {
	it("prefers the card under review over the open note", () => {
		const context = resolveAssistantContext({
			reviewCard: card(),
			activeNotePath: "Daily/2026-07-25.md",
			selectedText: null,
		});

		expect(context.card?.cardId).toBe("card-1");
		expect(context.activeNotePath).toBe("Learning/Memory.md");
	});

	it("falls back to the open note when no review is running", () => {
		const context = resolveAssistantContext({
			reviewCard: null,
			activeNotePath: "Daily/2026-07-25.md",
			selectedText: "  spacing effect  ",
		});

		expect(context.card).toBeUndefined();
		expect(context.activeNotePath).toBe("Daily/2026-07-25.md");
		expect(context.selectedText).toBe("spacing effect");
	});

	it("omits blank selections instead of passing empty strings downstream", () => {
		const context = resolveAssistantContext({
			reviewCard: null,
			activeNotePath: null,
			selectedText: "   ",
		});

		expect(context.selectedText).toBeUndefined();
		expect(context).toEqual({});
	});

	it("keeps the card without a note path when the card has no source", () => {
		const context = resolveAssistantContext({
			reviewCard: card({ sourceNotePath: undefined }),
			activeNotePath: null,
			selectedText: null,
		});

		expect(context.card?.cardId).toBe("card-1");
		expect(context.activeNotePath).toBeUndefined();
	});
});

describe("isSameAssistantSubject", () => {
	it("treats the same card as the same subject", () => {
		const inputs = {
			reviewCard: card(),
			activeNotePath: null,
			selectedText: null,
		};
		expect(
			isSameAssistantSubject(
				resolveAssistantContext(inputs),
				resolveAssistantContext(inputs),
			),
		).toBe(true);
	});

	it("detects a card change", () => {
		expect(
			isSameAssistantSubject(
				resolveAssistantContext({
					reviewCard: card(),
					activeNotePath: null,
					selectedText: null,
				}),
				resolveAssistantContext({
					reviewCard: card({ id: "card-2" }),
					activeNotePath: null,
					selectedText: null,
				}),
			),
		).toBe(false);
	});
});

describe("describeAssistantContext", () => {
	it("labels a card by its question", () => {
		expect(
			describeAssistantContext({ card: { question: "Q?" } as never }),
		).toBe("Q?");
	});

	it("labels a note by its basename without extension", () => {
		expect(
			describeAssistantContext({ activeNotePath: "Learning/Memory.md" }),
		).toBe("Memory");
	});

	it("reports an empty subject", () => {
		expect(describeAssistantContext({})).toBe("No card or note");
	});
});
