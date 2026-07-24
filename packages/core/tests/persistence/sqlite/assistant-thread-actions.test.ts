import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AssistantManifest } from "../../../src/ai/assistant";
import { AssistantTaskActions } from "../../../src/persistence/sqlite/modules/AssistantTaskActions";
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

	describe("archival task cleanup", () => {
		let tasks: AssistantTaskActions;

		beforeEach(() => {
			tasks = new AssistantTaskActions(ctx.db as never);
		});

		function insertThread(id: string, state: "inbox" | "active" | "archived") {
			threads.insert({
				id,
				title: id,
				context: {},
				state,
				message: { id: `m-${id}`, role: "user", content: id, createdAt: 1 },
				activeTaskId: `active-${id}`,
				createdAt: 1,
			});
		}

		function seedDoneTask(id: string, threadId: string | undefined) {
			tasks.insert({
				id,
				threadId,
				instruction: "generate",
				context: {},
				createdAt: 1,
			});
			tasks.claimNextPending();
			tasks.complete(id, INITIAL, 2);
		}

		it("deletes the thread's terminal tasks when it is archived", () => {
			insertThread("t1", "inbox");
			seedDoneTask("task-1", "t1");
			expect(tasks.getById("task-1")).not.toBeNull();

			threads.setState("t1", "archived", 3);

			expect(tasks.getById("task-1")).toBeNull();
		});

		it("keeps tasks when a thread moves to a non-archived state", () => {
			insertThread("t1", "active");
			seedDoneTask("task-1", "t1");

			threads.setState("t1", "inbox", 3);

			expect(tasks.getById("task-1")).not.toBeNull();
		});

		it("only deletes tasks of the archived thread, not siblings", () => {
			insertThread("t1", "inbox");
			insertThread("t2", "inbox");
			seedDoneTask("task-1", "t1");
			seedDoneTask("task-2", "t2");

			threads.setState("t1", "archived", 3);

			expect(tasks.getById("task-1")).toBeNull();
			expect(tasks.getById("task-2")).not.toBeNull();
		});

		it("sweeps orphaned tasks (archived or missing thread), keeps inbox and standalone", () => {
			insertThread("t-inbox", "inbox");
			insertThread("t-arch", "archived");
			seedDoneTask("task-inbox", "t-inbox");
			seedDoneTask("task-arch", "t-arch");
			seedDoneTask("task-missing", "ghost-thread");
			seedDoneTask("task-standalone", undefined);

			const removed = threads.deleteOrphanedTasks();

			expect(removed).toBe(2);
			expect(tasks.getById("task-inbox")).not.toBeNull();
			expect(tasks.getById("task-standalone")).not.toBeNull();
			expect(tasks.getById("task-arch")).toBeNull();
			expect(tasks.getById("task-missing")).toBeNull();
		});
	});
});
