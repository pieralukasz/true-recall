import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { chatTask } from "@true-recall/obsidian/features/ai-chat/engine/chat-transport";
import {
	findDuplicateProposals,
	flagDuplicateCards,
	normalizeQuestion,
} from "@true-recall/obsidian/features/ai-chat/engine/duplicate-cards";
import { buildGapCardsRequest } from "@true-recall/obsidian/features/ai-chat/engine/gap-cards";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	createTestContext,
	type TestContext,
} from "../../../../core/tests/persistence/sqlite/__setup__/test-database";
import { createMockChatPlugin } from "./mocks";

describe("gap cards request", () => {
	it("lists only the missing and wrong points, and asks to search first", () => {
		const text = buildGapCardsRequest({
			missing: ["~1/λ⁴ dependence", "  "],
			errors: ["violet is not absorbed by the eye"],
		});
		expect(text).toContain("- missing: ~1/λ⁴ dependence");
		expect(text).toContain(
			"- wrong in my answer: violet is not absorbed by the eye",
		);
		expect(text).not.toMatch(/- missing: $/m);
		expect(text).toContain("search_cards");
		expect(text).toContain("the card in context counts too");
		expect(text).toContain("only appears inside a longer answer");
		expect(text).toContain("propose nothing");
		expect(text).toContain("never its id");
		expect(text).toContain("CARD RULES");
		expect(text).toContain("card's language");
	});

	it("runs as a plain chat, not a Card Polish preset", () => {
		// No preset in the context: the model is not forced into a proposal
		// on its first step and the proxy routes it like a question.
		expect(
			chatTask({
				context: {
					card: { id: "c1", label: "Q" },
					reviewAttempt: { typedAnswer: "a", missing: ["b"] },
				},
			}),
		).toBe("chat");
	});
});

describe("duplicate proposals", () => {
	it("normalizes emphasis, spacing, case and the closing question mark", () => {
		expect(normalizeQuestion("  What is **Ohm's**   law? ")).toBe(
			"what is ohm's law",
		);
		expect(normalizeQuestion("`x`")).toBe("x");
	});

	it("flags existing questions and repeats inside the proposal", () => {
		expect(
			flagDuplicateCards(
				[
					{ question: "Jak natężenie **rozpraszania Rayleigha** zależy od λ?" },
					{ question: "Dlaczego nie widzimy fioletu?" },
					{ question: "dlaczego nie widzimy fioletu" },
					{ question: "" },
				],
				["Jak natężenie rozpraszania Rayleigha zależy od λ"],
			),
		).toEqual([true, false, true, false]);
	});

	it("asks the collection for exact questions outside the note", () => {
		const asked: string[] = [];
		expect(
			flagDuplicateCards([{ question: " Elsewhere? " }], [], (q) => {
				asked.push(q);
				return true;
			}),
		).toEqual([true]);
		expect(asked).toEqual(["Elsewhere?"]);
	});

	describe("against the store", () => {
		let ctx: TestContext;
		let plugin: TrueRecallPlugin;
		beforeEach(async () => {
			ctx = await createTestContext();
			plugin = createMockChatPlugin(ctx);
		});
		afterEach(() => ctx.close());

		it("flags the card in context, its note's cards and exact matches elsewhere", () => {
			const create = (front: string, sourceUid?: string) =>
				plugin.flashcardManager.createNote({
					noteTypeId: "builtin-basic",
					fields: { Front: front, Back: "A" },
					sourceUid,
				}).cards[0].id;
			const current = create("Why is the sky blue?", "sky");
			create("How does **Rayleigh scattering** depend on λ?", "sky");
			create("What is Ohm's law?", "ohm");
			const flags = findDuplicateProposals(
				plugin,
				{ card: { id: current, label: "Why is the sky blue?" } },
				[
					{ question: "why is the sky blue" },
					{ question: "How does Rayleigh scattering depend on λ?" },
					{ question: "What is Ohm's law?" },
					{ question: "Why don't we see a violet sky?" },
				],
			);
			expect(flags).toEqual([true, true, true, false]);
		});
	});
});
