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
