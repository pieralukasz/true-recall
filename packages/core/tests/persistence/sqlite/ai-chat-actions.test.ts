import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	AiChatActions,
	type AiChatRecord,
} from "../../../src/persistence/sqlite/modules/AiChatActions";
import { createTestContext, type TestContext } from "./__setup__/test-database";

function chat(overrides: Partial<AiChatRecord> = {}): AiChatRecord {
	return {
		id: "c1",
		title: "Elektryczność",
		context: { notePath: "Elektrycznosc.md" },
		messages: [
			{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
		],
		decisions: {},
		pendingCount: 0,
		createdAt: 1000,
		updatedAt: 1000,
		...overrides,
	};
}

describe("AiChatActions", () => {
	let ctx: TestContext;
	let chats: AiChatActions;

	beforeEach(async () => {
		ctx = await createTestContext();
		chats = new AiChatActions(ctx.db as never);
	});

	afterEach(() => ctx.close());

	it("round-trips a chat with its messages and decisions", () => {
		chats.save(chat({ decisions: { call1: { added: 2 } }, pendingCount: 1 }));
		const loaded = chats.get("c1");
		expect(loaded?.messages).toEqual(chat().messages);
		expect(loaded?.decisions).toEqual({ call1: { added: 2 } });
		expect(loaded?.pendingCount).toBe(1);
		expect(loaded?.context).toEqual({ notePath: "Elektrycznosc.md" });
	});

	it("updates in place and keeps the creation time", () => {
		chats.save(chat());
		chats.save(chat({ title: "Nowy", createdAt: 5000, updatedAt: 6000 }));
		const loaded = chats.get("c1");
		expect(loaded?.title).toBe("Nowy");
		expect(loaded?.createdAt).toBe(1000);
		expect(loaded?.updatedAt).toBe(6000);
	});

	it("lists newest first and sums the waiting proposals", () => {
		chats.save(chat({ id: "old", updatedAt: 1000, pendingCount: 2 }));
		chats.save(chat({ id: "new", updatedAt: 2000, pendingCount: 3 }));
		chats.save(chat({ id: "done", updatedAt: 1500 }));
		expect(chats.list().map((c) => c.id)).toEqual(["new", "done", "old"]);
		expect(chats.pendingTotal()).toBe(5);
	});

	it("returns zero pending on an empty table and deletes chats", () => {
		expect(chats.pendingTotal()).toBe(0);
		chats.save(chat());
		chats.delete("c1");
		expect(chats.get("c1")).toBeNull();
	});

	it("keeps old pending and completed conversations reachable after 100 newer chats", () => {
		chats.save(chat({ id: "waiting", pendingCount: 1, updatedAt: 1 }));
		chats.save(chat({ id: "old-completed", updatedAt: 2 }));
		for (let i = 0; i < 100; i++) {
			chats.save(chat({ id: `recent-${i}`, updatedAt: 100 + i }));
		}
		expect(chats.list()).toHaveLength(102);
		expect(
			chats
				.list()
				.filter((c) => c.pendingCount > 0)
				.map((c) => c.id),
		).toEqual(["waiting"]);
		expect(chats.pendingTotal()).toBe(1);
		expect(chats.list(10)).toHaveLength(10);
	});

	it("persists draft work separately from the model's messages and user decisions", () => {
		const drafts = {
			call1: { picked: [false, true], fieldEdits: { Back: "Correction" } },
		};
		chats.save(chat({ drafts }));
		expect(chats.get("c1")?.drafts).toEqual(drafts);
		expect(chats.get("c1")?.messages).toEqual(chat().messages);
		expect(chats.list()[0]).not.toHaveProperty("drafts");
	});
});
