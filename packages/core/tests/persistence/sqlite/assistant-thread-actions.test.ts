import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AssistantManifest } from "../../../src/ai/assistant";
import { AssistantThreadActions } from "../../../src/persistence/sqlite/modules/AssistantThreadActions";
import { createTestContext, type TestContext } from "./__setup__/test-database";

const INITIAL: AssistantManifest = {
	proposals: [
		{
			id: "proposal-1",
			status: "proposed",
			type: "create_card",
			noteTypeId: "builtin-basic",
			fields: { Front: "Question", Back: "Answer" },
		},
	],
	citations: [],
};

describe("AssistantThreadActions", () => {
	let ctx: TestContext;
	let threads: AssistantThreadActions;

	beforeEach(async () => {
		ctx = await createTestContext();
		threads = new AssistantThreadActions(ctx.db as never);
	});

	afterEach(() => ctx.close());

	it("persists a materialized draft conversation and restores the previous AI turn", () => {
		threads.insert({
			id: "thread-1",
			title: "Create cards",
			context: { selectedText: "source" },
			state: "active",
			message: { id: "m1", role: "user", content: "Create", createdAt: 1000 },
			activeTaskId: "task-1",
			createdAt: 1000,
		});
		threads.completeTurn({
			id: "thread-1",
			taskId: "task-1",
			manifest: INITIAL,
			message: {
				id: "m2",
				role: "assistant",
				content: "Done",
				createdAt: 1100,
			},
			updatedAt: 1100,
		});

		threads.beginTurn({
			id: "thread-1",
			taskId: "task-2",
			message: { id: "m3", role: "user", content: "Shorter", createdAt: 1200 },
			updatedAt: 1200,
		});
		const changed = structuredClone(INITIAL);
		const proposal = changed.proposals[0];
		if (proposal?.type === "create_card") proposal.fields.Back = "A";
		threads.completeTurn({
			id: "thread-1",
			taskId: "task-2",
			manifest: changed,
			message: {
				id: "m4",
				role: "assistant",
				content: "Updated",
				createdAt: 1300,
			},
			updatedAt: 1300,
		});

		expect(threads.getById("thread-1")?.revision).toBe(2);
		expect(threads.getById("thread-1")?.messages).toHaveLength(4);

		const restored = threads.undoLastTurn("thread-1", 1400);
		expect(restored?.revision).toBe(1);
		expect(restored?.messages.map((message) => message.id)).toEqual([
			"m1",
			"m2",
		]);
		expect(restored?.manifest).toEqual(INITIAL);
	});

	it("lists only conversations explicitly handed to the inbox", () => {
		for (const [id, state] of [
			["active", "active"],
			["later", "inbox"],
		] as const) {
			threads.insert({
				id,
				title: id,
				context: {},
				state,
				message: { id: `m-${id}`, role: "user", content: id, createdAt: 1 },
				activeTaskId: `t-${id}`,
				createdAt: 1,
			});
		}

		expect(threads.list("inbox").map((thread) => thread.id)).toEqual(["later"]);
	});

	it("keeps inbox ordering stable when proposal review updates the manifest", () => {
		for (const [id, createdAt] of [
			["older", 1000],
			["newer", 2000],
		] as const) {
			threads.insert({
				id,
				title: id,
				context: {},
				state: "inbox",
				message: { id: `m-${id}`, role: "user", content: id, createdAt },
				activeTaskId: `t-${id}`,
				createdAt,
			});
		}

		const reviewed = structuredClone(INITIAL);
		const proposal = reviewed.proposals[0];
		if (proposal) proposal.status = "applied";
		threads.updateManifest("older", reviewed);

		expect(threads.getById("older")?.manifest).toEqual(reviewed);
		expect(threads.getById("older")?.updatedAt).toBe(1000);
		expect(threads.list("inbox").map((thread) => thread.id)).toEqual([
			"newer",
			"older",
		]);
	});
});
