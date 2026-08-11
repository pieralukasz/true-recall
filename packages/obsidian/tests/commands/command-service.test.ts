import { describe, expect, it } from "vitest";

import type { CommandContext } from "../../src/commands/command.types";
import { CommandService } from "../../src/commands/command-service";
import { BatchCreateCommand } from "../../src/commands/commands/card-create.cmd";

function createService(): CommandService {
	return new CommandService({} as CommandContext);
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
