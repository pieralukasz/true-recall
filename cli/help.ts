import type { CommandDef } from "./registry.js";

export function printGlobalHelp(commands: CommandDef[]): void {
	const grouped = new Map<string, CommandDef[]>();
	for (const cmd of commands) {
		const list = grouped.get(cmd.category) ?? [];
		list.push(cmd);
		grouped.set(cmd.category, list);
	}

	const lines: string[] = [
		"true-recall — CLI for True Recall Obsidian plugin",
		"",
		"Usage: true-recall <command> [--flag value ...]",
		"",
	];

	for (const [category, cmds] of grouped) {
		lines.push(`${category}:`);
		for (const cmd of cmds) {
			const name = cmd.name.padEnd(28);
			lines.push(`  ${name}${cmd.description}`);
		}
		lines.push("");
	}

	lines.push("Options:");
	lines.push("  --help                        Show help for a command");
	lines.push(
		"  --port <number>               Override API port (default: 27182)",
	);
	lines.push("");
	lines.push("Examples:");
	lines.push("  true-recall get_status");
	lines.push("  true-recall list_cards --state review --limit 10");
	lines.push("  true-recall grade_review_card --rating 3");

	console.log(lines.join("\n"));
}

export function printCommandHelp(cmd: CommandDef): void {
	const lines: string[] = [`true-recall ${cmd.name}`, "", cmd.description, ""];

	if (cmd.params && Object.keys(cmd.params).length > 0) {
		lines.push("Parameters:");
		for (const [name, def] of Object.entries(cmd.params)) {
			const req = def.required ? " (required)" : "";
			const dflt =
				def.default !== undefined ? ` [default: ${def.default}]` : "";
			const enm = def.enum ? ` [choices: ${def.enum.join(", ")}]` : "";
			lines.push(`  --${name.padEnd(24)}${def.description}${req}${dflt}${enm}`);
		}
	} else {
		lines.push("No parameters.");
	}

	console.log(lines.join("\n"));
}
