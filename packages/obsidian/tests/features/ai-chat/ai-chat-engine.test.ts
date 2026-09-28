import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
	chatTitle,
	contextKinds,
	fromAssistantContext,
	shorten,
	withoutKind,
} from "@true-recall/obsidian/features/ai-chat/engine/chat-context";
import { buildChatInstructions } from "@true-recall/obsidian/features/ai-chat/engine/chat-prompt";
import {
	changedFields,
	countPending,
	describeDecisions,
	mergeFields,
	normalizeCard,
	pickCards,
	proposalCallIds,
} from "@true-recall/obsidian/features/ai-chat/engine/proposals";

function assistant(parts: unknown[]): UIMessage {
	return { id: `m-${Math.random()}`, role: "assistant", parts } as UIMessage;
}

const proposal = (
	id: string,
	state = "output-available",
	output: unknown = { shown: 2 },
) => ({
	type: "tool-propose_cards",
	toolCallId: id,
	state,
	input: { cards: [] },
	output,
});

describe("AI chat proposals", () => {
	it("counts only finished proposals without a decision", () => {
		const messages = [
			assistant([{ type: "text", text: "Here" }, proposal("a"), proposal("b")]),
			assistant([proposal("c", "input-streaming", undefined)]),
			assistant([
				{
					type: "tool-propose_card_edit",
					toolCallId: "d",
					state: "output-available",
					output: { error: "Card not found" },
				},
			]),
			assistant([
				{
					type: "tool-search_cards",
					toolCallId: "e",
					state: "output-available",
				},
			]),
		];
		expect(proposalCallIds(messages)).toEqual(["a", "b"]);
		expect(countPending(messages, {})).toBe(2);
		expect(countPending(messages, { a: { kind: "skipped", at: 1 } })).toBe(1);
	});

	it("tells the model what the user decided", () => {
		const text = describeDecisions({
			a: {
				kind: "cards-added",
				cardIds: ["c1", "c2"],
				added: 2,
				proposed: 3,
				at: 1,
			},
			b: { kind: "skipped", at: 2 },
		});
		expect(text).toContain("added 2 of 3 proposed cards (card ids: c1, c2)");
		expect(text).toContain("b: the user skipped");
	});

	it("accepts Front/Back and half-streamed cards", () => {
		expect(normalizeCard({ Front: "Q?", Back: "A" })).toEqual({
			question: "Q?",
			answer: "A",
		});
		expect(normalizeCard({ question: "Q?" })).toEqual({
			question: "Q?",
			answer: "",
		});
		expect(normalizeCard(undefined)).toEqual({ question: "", answer: "" });
	});

	it("adds the picked cards with the user's edits, dropping empty ones", () => {
		const cards = [
			{ question: "One?", answer: "1" },
			{ question: "Two?", answer: "2" },
			{ question: " ", answer: "3" },
			{ Front: "Four?", Back: "4" } as never,
		];
		const picked = pickCards(cards, [true, false], {
			0: { question: "One (edited)?", answer: "1" },
		});
		expect(picked).toEqual([
			{ question: "One (edited)?", answer: "1" },
			{ question: "Four?", answer: "4" },
		]);
	});

	it("changes only fields the note has, and lists the real changes", () => {
		const before = { Front: "Old", Back: "Same" };
		const changes = { Front: "New", Back: "Same", Extra: "x" };
		expect(mergeFields(before, changes)).toEqual({
			Front: "New",
			Back: "Same",
		});
		expect(changedFields(before, changes)).toEqual(["Front"]);
	});
});

describe("AI chat context", () => {
	const file = (path: string) =>
		({
			path,
			basename: path.replace(/\.md$/, "").split("/").pop(),
			extension: "md",
		}) as never;

	it("maps the old assistant's context (card, selection, note)", () => {
		const ctx = fromAssistantContext(
			{
				selectedText: "  Ohm's law  ",
				card: {
					cardId: "c1",
					question: "What is **Ohm's law**?",
					answer: "U = RI",
					sourceNotePath: "Physics/Elektrycznosc.md",
				},
				activeNotePath: "Other.md",
			},
			file,
		);
		expect(ctx).toEqual({
			note: { path: "Physics/Elektrycznosc.md", title: "Elektrycznosc" },
			selection: { text: "Ohm's law", notePath: "Physics/Elektrycznosc.md" },
			card: { id: "c1", label: "What is Ohm's law?" },
		});
		expect(contextKinds(ctx)).toEqual(["card", "selection", "note"]);
		expect(withoutKind(ctx, "selection").selection).toBeUndefined();
	});

	it("ignores notes that do not resolve", () => {
		expect(
			fromAssistantContext({ activeNotePath: "Gone.md" }, () => null),
		).toEqual({});
	});

	it("shortens to one clean line", () => {
		expect(shorten("**Bold**  [[link]]\nnext", 12)).toBe("Bold link n…");
		expect(chatTitle("", { note: { path: "A.md", title: "A" } })).toBeTruthy();
	});
});

describe("AI chat instructions", () => {
	const base = {
		context: {},
		noteTypes: [{ id: "basic", name: "Basic", fields: ["Front", "Back"] }],
		webSearch: false,
		userInstructions: "",
		decisions: "",
		today: "2026-09-28",
	};

	it("includes the card, the preset and the decisions", () => {
		const text = buildChatInstructions({
			...base,
			context: { preset: { name: "Shorter", instruction: "Make it shorter." } },
			card: { id: "c1", noteType: "Basic", fields: { Front: "Q", Back: "A" } },
			decisions: "- a: the user skipped this proposal.",
			userInstructions: "Write in Polish.",
		});
		expect(text).toContain("Card in context (id c1, type Basic)");
		expect(text).toContain('PRESET "Shorter"');
		expect(text).toContain("USER DECISIONS ON EARLIER PROPOSALS");
		expect(text).toContain("USER'S INSTRUCTIONS:\nWrite in Polish.");
		expect(text).toContain("Web search is not available");
	});

	it("mentions web search only when it is on", () => {
		expect(buildChatInstructions({ ...base, webSearch: true })).toContain(
			"Web search results may be added",
		);
	});
});
