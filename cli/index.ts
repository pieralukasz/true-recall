#!/usr/bin/env bun
import { TrueRecallClient } from "./client.js";
import { backupCommands } from "./commands/backup.js";
import { cardActionCommands } from "./commands/card-actions.js";
import { cardCommands } from "./commands/cards.js";
import { contextCommands } from "./commands/context.js";
import { dashboardCommands } from "./commands/dashboard.js";
import { exportCommands } from "./commands/export.js";
import { fsrsCommands } from "./commands/fsrs.js";
import { fsrsAdvancedCommands } from "./commands/fsrs-advanced.js";
import { generateCommands } from "./commands/generate.js";
import { navigationCommands } from "./commands/navigation.js";
import { noteCommands } from "./commands/notes.js";
import { queryCommands } from "./commands/query.js";
import { ragCommands } from "./commands/rag.js";
import { reviewCommands } from "./commands/review.js";
import { sessionCommands } from "./commands/sessions.js";
import { statsCommands } from "./commands/stats.js";
import { printCommandHelp, printGlobalHelp } from "./help.js";
import { parseArgs } from "./parser.js";
import type { CommandDef } from "./registry.js";

const allCommands: CommandDef[] = [
	...contextCommands,
	...cardCommands,
	...cardActionCommands,
	...reviewCommands,
	...sessionCommands,
	...generateCommands,
	...dashboardCommands,
	...fsrsCommands,
	...fsrsAdvancedCommands,
	...exportCommands,
	...navigationCommands,
	...noteCommands,
	...backupCommands,
	...statsCommands,
	...queryCommands,
	...ragCommands,
];

const commandMap = new Map(allCommands.map((c) => [c.name, c]));

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		printGlobalHelp(allCommands);
		return;
	}

	const cmdName = args[0] as string;
	const cmd = commandMap.get(cmdName);

	if (!cmd) {
		console.error(JSON.stringify({ error: `Unknown command: ${cmdName}` }));
		process.exit(1);
	}

	const restArgs = args.slice(1);

	if (restArgs.includes("--help") || restArgs.includes("-h")) {
		printCommandHelp(cmd);
		return;
	}

	const params = parseArgs(restArgs, cmd.params);

	// Check for --port override
	const portArg = parseArgs(args, {
		port: { type: "number", description: "" },
	});
	const port = portArg.port as number | undefined;
	const client = new TrueRecallClient(port);

	try {
		const result = await cmd.handle(params, client);
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(
			JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
			}),
		);
		process.exit(1);
	}
}

main();
