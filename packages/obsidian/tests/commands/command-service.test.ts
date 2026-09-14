import { describe, expect, it } from "vitest";

import type { Command, CommandContext } from "../../src/commands/command.types";
import { CommandService } from "../../src/commands/command-service";
import { BatchCreateCommand } from "../../src/commands/commands/card-create.cmd";

function createService(): CommandService {
	return new CommandService({} as CommandContext);
}

function createNoopCommand(type: string): Command {
	return {
		type,
		description: type,
		mutationType: "card:updated",
		skipExecuteMutation: true,
		skipUndoMutation: true,
		execute: () => {},
		undo: () => {},
	};
}

describe("CommandService.isNextUndo", () => {
	it("identifies the exact command at the top of the undo stack", async () => {
		const service = createService();
		const first = new BatchCreateCommand(["first"]);
		const second = new BatchCreateCommand(["second"]);

		await service.execute(first);
		expect(service.isNextUndo(first)).toBe(true);

		await service.execute(second);
		expect(service.isNextUndo(first)).toBe(false);
		expect(service.isNextUndo(second)).toBe(true);
	});

	it("returns false after the history is cleared", async () => {
		const service = createService();
		const command = new BatchCreateCommand(["card"]);

		await service.execute(command);
		service.clear();

		expect(service.isNextUndo(command)).toBe(false);
	});
});

describe("CommandService cross-stack ordering", () => {
	it("selects the latest action across global and review services", async () => {
		const globalService = createService();
		const reviewService = createService();
		const baseline = CommandService.currentOrder();

		await reviewService.execute(createNoopCommand("review:answer"));
		await globalService.execute(createNoopCommand("card:ai-edit"));

		expect(
			CommandService.newestUndoService(
				[reviewService, globalService],
				baseline,
			),
		).toBe(globalService);

		await reviewService.execute(createNoopCommand("review:bury"));

		expect(
			CommandService.newestUndoService(
				[reviewService, globalService],
				baseline,
			),
		).toBe(reviewService);
	});

	it("ignores actions that predate the review view", async () => {
		const globalService = createService();
		await globalService.execute(createNoopCommand("card:old-edit"));
		const baseline = CommandService.currentOrder();

		expect(
			CommandService.newestUndoService([globalService], baseline),
		).toBeNull();
	});

	it("selects the most recently undone action for redo", async () => {
		const globalService = createService();
		const reviewService = createService();
		const baseline = CommandService.currentOrder();

		await globalService.execute(createNoopCommand("card:ai-edit"));
		await globalService.undo();

		expect(
			CommandService.newestRedoService(
				[reviewService, globalService],
				baseline,
			),
		).toBe(globalService);
	});
});

describe("CommandService failed history operations", () => {
	it("removes a deferred command when its later persistence step fails", async () => {
		const service = createService();
		let fail = () => {};
		const command: Command = {
			...createNoopCommand("review:deferred-failure"),
			deferred: true,
			onDeferredFailure(handler) {
				fail = handler;
			},
		};

		await service.execute(command);
		expect(service.canUndo()).toBe(true);

		fail();
		expect(service.canUndo()).toBe(false);
	});

	it("keeps a command on the undo stack when undo fails", async () => {
		const service = createService();
		const command = createNoopCommand("card:failing-undo");
		command.undo = () => {
			throw new Error("undo failed");
		};
		await service.execute(command);

		await expect(service.undo()).resolves.toBe(false);
		expect(service.canUndo()).toBe(true);
	});

	it("keeps a command on the redo stack when redo fails", async () => {
		const service = createService();
		const command = createNoopCommand("card:failing-redo");
		await service.execute(command);
		await service.undo();
		command.execute = () => {
			throw new Error("redo failed");
		};

		await expect(service.redo()).resolves.toBe(false);
		expect(service.canRedo()).toBe(true);
	});
});
