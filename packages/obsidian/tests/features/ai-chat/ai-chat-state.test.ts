import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiChatController } from "@true-recall/obsidian/features/ai-chat/chat-controller";
import {
	addProposedCards,
	applyCardEdit,
	revertCardEdit,
} from "@true-recall/obsidian/features/ai-chat/engine/chat-apply";
import {
	createChatTools,
	readCardFields,
} from "@true-recall/obsidian/features/ai-chat/engine/chat-tools";
import type { ProposalDraft } from "@true-recall/obsidian/features/ai-chat/engine/proposals";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

import {
	createTestContext,
	type TestContext,
} from "../../../../core/tests/persistence/sqlite/__setup__/test-database";
import { createMockChatPlugin, createMockChatResponse } from "./mocks";

describe("AI chat writes", () => {
	let ctx: TestContext;
	let plugin: TrueRecallPlugin;
	beforeEach(async () => {
		ctx = await createTestContext();
		plugin = createMockChatPlugin(ctx);
		vi.stubGlobal("activeWindow", { dispatchEvent: vi.fn() });
	});
	afterEach(() => {
		ctx.close();
		vi.unstubAllGlobals();
	});

	it("skips existing questions and duplicates within the same proposal", async () => {
		const card = { question: "Question", answer: "Answer" };
		expect(await addProposedCards(plugin, [card, card], {})).toHaveLength(1);
		expect(await addProposedCards(plugin, [card], {})).toHaveLength(0);
		expect(
			ctx.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM notes")
				?.count,
		).toBe(1);
	});

	it("undoes an unchanged applied edit", async () => {
		const [id] = await addProposedCards(
			plugin,
			[{ question: "Q", answer: "A" }],
			{},
		);
		const original = readCardFields(plugin, id);
		if (!original) throw new Error("Missing card");
		const result = applyCardEdit(
			plugin,
			id,
			{ Back: "AI answer" },
			original.fields,
		);
		if (!result.ok) throw new Error("Apply failed");
		expect(
			revertCardEdit(plugin, id, result.noteId, result.before, result.after),
		).toEqual({ ok: true });
		expect(ctx.notes.getById(original.noteId)?.fields).toEqual(original.fields);
	});

	it("refuses Undo after a manual change, including a field AI did not edit", async () => {
		const [id] = await addProposedCards(
			plugin,
			[{ question: "Q", answer: "A" }],
			{},
		);
		const original = readCardFields(plugin, id);
		if (!original) throw new Error("Missing card");
		const result = applyCardEdit(
			plugin,
			id,
			{ Back: "AI answer" },
			original.fields,
		);
		if (!result.ok) throw new Error("Apply failed");
		const later = { ...result.after, Front: "Later manual question" };
		ctx.notes.update(original.noteId, { fields: later });
		expect(
			revertCardEdit(plugin, id, result.noteId, result.before, result.after),
		).toEqual({ ok: false, error: "changed" });
		expect(ctx.notes.getById(original.noteId)?.fields).toEqual(later);
	});

	it("keeps the snapshot from get_card when a user edits during generation", async () => {
		const [id] = await addProposedCards(
			plugin,
			[{ question: "Q", answer: "Original" }],
			{},
		);
		const tools = createChatTools(plugin);
		const options = { toolCallId: "call-1", messages: [] };
		await tools.get_card.execute?.({ cardId: id }, options);
		const original = readCardFields(plugin, id);
		if (!original) throw new Error("Missing card");
		ctx.notes.update(original.noteId, {
			fields: { ...original.fields, Back: "Manual answer" },
		});
		const proposal = await tools.propose_card_edit.execute?.(
			{ cardId: id, fields: { Back: "AI answer" } },
			options,
		);
		if (!proposal || !("before" in proposal) || !proposal.before)
			throw new Error("Missing proposal");
		expect(proposal.before.Back).toBe("Original");
		expect(
			applyCardEdit(plugin, id, { Back: "AI answer" }, proposal.before),
		).toEqual({ ok: false, error: "changed" });
	});

	it("rejects an edit of a card the model has not read", async () => {
		const [id] = await addProposedCards(
			plugin,
			[{ question: "Q", answer: "A" }],
			{},
		);
		const result = await createChatTools(plugin).propose_card_edit.execute?.(
			{ cardId: id, fields: { Back: "AI" } },
			{ toolCallId: "call-1", messages: [] },
		);
		expect(result).toEqual({
			error: "Read this card with get_card before proposing an edit.",
		});
	});

	it("uses the prompt's snapshot when the provider responds after a manual edit", async () => {
		const [id] = await addProposedCards(
			plugin,
			[{ question: "Q", answer: "Original" }],
			{},
		);
		const original = readCardFields(plugin, id);
		if (!original) throw new Error("Missing card");
		vi.stubGlobal("activeWindow", {
			fetch: vi.fn(async () => {
				ctx.notes.update(original.noteId, {
					fields: { ...original.fields, Back: "Manual answer" },
				});
				return createMockChatResponse({
					name: "propose_card_edit",
					args: { cardId: id, fields: { Back: "AI" } },
				});
			}),
		});
		const controller = new AiChatController(plugin, async () => {});
		controller.setContext(controller.currentId, { card: { id } });
		await controller.send(controller.currentId, "Improve this card");
		expect(controller.current.chat.error).toBeUndefined();
		const part = controller.current.chat.messages
			.at(-1)
			?.parts.find((part) => part.type === "tool-propose_card_edit");
		expect(part).toMatchObject({
			state: "output-available",
			output: { before: original.fields },
		});
		controller.dispose();
	});
});

describe("AI chat proposal drafts", () => {
	let ctx: TestContext;
	beforeEach(async () => {
		ctx = await createTestContext();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
	});
	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	it("preserves picks, saved edits and unfinished editing across history, review handoff and reload", async () => {
		const plugin = createMockChatPlugin(ctx);
		const controller = new AiChatController(plugin, async () => {});
		const session = await controller.startForCard("c1", {
			context: { card: { id: "c1" } },
		});
		session.chat.messages = [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "Make cards" }] },
		];
		const draft: ProposalDraft = {
			picked: [true, false],
			cardEdits: { 0: { question: "Edited Q", answer: "Edited A" } },
			cardEditor: {
				index: 1,
				value: { question: "Unfinished Q", answer: "A" },
			},
		};
		controller.updateDraft(session.id, "new-cards", draft);
		controller.updateDraft(session.id, "edit-card", {
			fieldEdits: { Back: "Manual correction" },
			editingFields: true,
		});
		await controller.continueInChat(session.id);
		controller.toggleHistory(true);
		controller.open(session.id);
		expect(controller.current.drafts["new-cards"]).toEqual(draft);
		controller.dispose();
		const reopened = new AiChatController(plugin, async () => {});
		reopened.open(session.id);
		expect(reopened.current.drafts["new-cards"]).toEqual(draft);
		expect(reopened.current.drafts["edit-card"]).toEqual({
			fieldEdits: { Back: "Manual correction" },
			editingFields: true,
		});
		reopened.updateDraft(session.id, "new-cards", { cardEditor: undefined });
		expect(
			plugin.cardStore?.aiChats.get(session.id)?.drafts?.["new-cards"],
		).toEqual({ picked: draft.picked, cardEdits: draft.cardEdits });
		reopened.dispose();
	});
});
