import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AssistantTaskActions } from "../../../src/persistence/sqlite/modules/AssistantTaskActions";
import { createTestContext, type TestContext } from "./__setup__/test-database";

describe("AssistantTaskActions", () => {
	let ctx: TestContext;
	let tasks: AssistantTaskActions;

	beforeEach(async () => {
		ctx = await createTestContext();
		tasks = new AssistantTaskActions(ctx.db as never);
	});
	afterEach(() => ctx.close());

	function insertOne(id = "task-1") {
		tasks.insert({
			id,
			instruction: "research odbiornik",
			presetId: "assistant-cards",
			context: { selectedText: "odbiornik" },
			createdAt: 1000,
		});
	}

	it("inserts and reads back a pending task", () => {
		insertOne();
		const task = tasks.getById("task-1");
		expect(task?.status).toBe("pending");
		expect(task?.instruction).toBe("research odbiornik");
		expect(task?.context.selectedText).toBe("odbiornik");
	});

	it("claims the oldest pending task and marks it running", () => {
		insertOne("task-1");
		insertOne("task-2");
		const claimed = tasks.claimNextPending();
		expect(claimed?.id).toBe("task-1");
		expect(tasks.getById("task-1")?.status).toBe("running");
		expect(tasks.getById("task-2")?.status).toBe("pending");
	});

	it("completes a task with a manifest", () => {
		insertOne();
		tasks.claimNextPending();
		tasks.complete(
			"task-1",
			{ proposals: [], citations: [], finalText: "ok" },
			2000,
		);
		const task = tasks.getById("task-1");
		expect(task?.status).toBe("done");
		expect(task?.manifest?.finalText).toBe("ok");
		expect(task?.finishedAt).toBe(2000);
	});

	it("fails a task with an error and resets running tasks to pending on recovery", () => {
		insertOne("task-1");
		insertOne("task-2");
		tasks.claimNextPending();
		tasks.fail("task-1", "network down", 2000);
		expect(tasks.getById("task-1")?.error).toBe("network down");

		tasks.claimNextPending();
		const reset = tasks.resetRunningToPending();
		expect(reset).toBe(1);
		expect(tasks.getById("task-2")?.status).toBe("pending");
	});

	it("updates the manifest in place and lists newest first", () => {
		insertOne("task-1");
		tasks.insert({
			id: "task-2",
			instruction: "x",
			context: {},
			createdAt: 5000,
		});
		tasks.updateManifest("task-1", {
			proposals: [],
			citations: [{ url: "https://a" }],
		});
		expect(tasks.getById("task-1")?.manifest?.citations[0]?.url).toBe(
			"https://a",
		);
		expect(tasks.list().map((t) => t.id)).toEqual(["task-2", "task-1"]);
	});
});
