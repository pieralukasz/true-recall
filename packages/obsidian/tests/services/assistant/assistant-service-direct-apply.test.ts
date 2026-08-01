import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	AssistantManifest,
	AssistantTask,
} from "@true-recall/core/ai/assistant";

const mocks = vi.hoisted(() => ({
	apply: vi.fn(),
	cardsCreated: vi.fn(),
	cardsCreatedWithDuplicates: vi.fn(),
	error: vi.fn(),
	aiDraftsReady: vi.fn(),
	warning: vi.fn(),
	success: vi.fn(),
}));

vi.mock("../../../src/services/assistant/assistant-apply.service", () => ({
	AssistantApplyService: class {
		apply = mocks.apply;
	},
}));

vi.mock("../../../src/services/notification.service", () => ({
	notify: () => ({
		cardsCreated: mocks.cardsCreated,
		cardsCreatedWithDuplicates: mocks.cardsCreatedWithDuplicates,
		error: mocks.error,
		aiDraftsReady: mocks.aiDraftsReady,
		warning: mocks.warning,
		success: mocks.success,
	}),
}));

import { AssistantService } from "../../../src/services/assistant/assistant.service";

function createManifest(): AssistantManifest {
	return {
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
}

function createTask(immediate: boolean): AssistantTask {
	return {
		id: "task-1",
		threadId: "thread-1",
		instruction: "Generate cards",
		presetId: "generation:basic",
		context: {
			selectedText: "Source text",
			...(immediate ? { applyGeneratedCardsImmediately: true } : {}),
		},
		status: "done",
		createdAt: 1,
	};
}

function createService(manifest: AssistantManifest) {
	const taskActions = { updateManifest: vi.fn() };
	const threadActions = {
		getById: vi.fn(() => ({
			id: "thread-1",
			manifest,
			activeTaskId: undefined,
		})),
		updateManifest: vi.fn(),
		setState: vi.fn(),
	};
	const plugin = {
		settings: {
			generationPresets: [
				{
					id: "basic",
					name: "Basic",
					prompt: "Generate cards",
					noteTypeId: "builtin-basic",
				},
			],
		},
		cardStore: {
			assistantTasks: taskActions,
			assistantThreads: threadActions,
		},
		dataLayer: { invalidateGroups: vi.fn() },
		app: { vault: { getAbstractFileByPath: vi.fn(() => null) } },
	};
	return {
		service: new AssistantService(plugin as never),
		taskActions,
		threadActions,
	};
}

async function notifyCompleted(
	service: AssistantService,
	task: AssistantTask,
	manifest: AssistantManifest,
): Promise<void> {
	await (
		service as unknown as {
			notifyTaskCompleted: (
				task: AssistantTask,
				manifest: AssistantManifest,
			) => Promise<void>;
		}
	).notifyTaskCompleted(task, manifest);
}

describe("AssistantService direct generation apply", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.apply.mockResolvedValue({ ok: true, createdCount: 1 });
	});

	it("applies and archives note-triggered generation without creating an inbox draft", async () => {
		const manifest = createManifest();
		const task = createTask(true);
		const { service, taskActions, threadActions } = createService(manifest);

		await notifyCompleted(service, task, manifest);

		expect(mocks.apply).toHaveBeenCalledTimes(1);
		expect(manifest.proposals[0]?.status).toBe("applied");
		expect(taskActions.updateManifest).toHaveBeenCalledWith(task.id, manifest);
		expect(threadActions.updateManifest).toHaveBeenCalledWith(
			task.threadId,
			manifest,
		);
		expect(threadActions.setState).toHaveBeenCalledWith(
			task.threadId,
			"archived",
			expect.any(Number),
		);
		expect(threadActions.setState).not.toHaveBeenCalledWith(
			task.threadId,
			"inbox",
			expect.any(Number),
		);
		expect(mocks.aiDraftsReady).not.toHaveBeenCalled();
		expect(mocks.cardsCreated).toHaveBeenCalledWith(1, undefined);
	});

	it("keeps the review inbox behavior for generation outside a source-note action", async () => {
		const manifest = createManifest();
		const task = createTask(false);
		const { service, threadActions } = createService(manifest);

		await notifyCompleted(service, task, manifest);

		expect(mocks.apply).not.toHaveBeenCalled();
		expect(threadActions.setState).toHaveBeenCalledWith(
			task.threadId,
			"inbox",
			expect.any(Number),
		);
		expect(mocks.aiDraftsReady).toHaveBeenCalledTimes(1);
	});

	it("reports a skipped duplicate as a duplicate, not as a created card", async () => {
		mocks.apply.mockResolvedValue({ ok: true, createdCount: 0 });
		const manifest = createManifest();
		const task = createTask(true);
		const { service } = createService(manifest);

		await notifyCompleted(service, task, manifest);

		expect(mocks.cardsCreated).not.toHaveBeenCalled();
		expect(mocks.cardsCreatedWithDuplicates).toHaveBeenCalledWith(
			0,
			1,
			undefined,
		);
	});

	it("reports the streaming engine's own counts without re-applying anything", async () => {
		const manifest: AssistantManifest = {
			proposals: [],
			citations: [],
			directGeneration: {
				created: 3,
				duplicates: 2,
				failedChunks: 0,
				totalChunks: 1,
				errors: [],
				sourceName: "My Note",
			},
		};
		const task = createTask(true);
		const { service, threadActions } = createService(manifest);

		await notifyCompleted(service, task, manifest);

		expect(mocks.apply).not.toHaveBeenCalled();
		expect(mocks.warning).not.toHaveBeenCalled();
		expect(mocks.cardsCreatedWithDuplicates).toHaveBeenCalledWith(
			3,
			2,
			"My Note",
		);
		expect(threadActions.setState).toHaveBeenCalledWith(
			task.threadId,
			"archived",
			expect.any(Number),
		);
	});

	it("warns when the streaming engine produced nothing at all", async () => {
		const manifest: AssistantManifest = {
			proposals: [],
			citations: [],
			directGeneration: {
				created: 0,
				duplicates: 0,
				failedChunks: 0,
				totalChunks: 1,
				errors: [],
				sourceName: "My Note",
			},
		};
		const task = createTask(true);
		const { service } = createService(manifest);

		await notifyCompleted(service, task, manifest);

		expect(mocks.warning).toHaveBeenCalledWith(
			"AI generation finished without flashcards",
		);
		expect(mocks.cardsCreated).not.toHaveBeenCalled();
	});

	it("archives a failed direct apply instead of leaving a draft in the inbox", async () => {
		mocks.apply.mockResolvedValue({ ok: false, error: "Create failed" });
		const manifest = createManifest();
		const task = createTask(true);
		const { service, threadActions } = createService(manifest);

		await notifyCompleted(service, task, manifest);

		expect(manifest.proposals[0]?.status).toBe("rejected");
		expect(threadActions.setState).toHaveBeenCalledWith(
			task.threadId,
			"archived",
			expect.any(Number),
		);
		expect(threadActions.setState).not.toHaveBeenCalledWith(
			task.threadId,
			"inbox",
			expect.any(Number),
		);
		expect(mocks.aiDraftsReady).not.toHaveBeenCalled();
		expect(mocks.error).toHaveBeenCalledWith("Create failed");
	});
});
