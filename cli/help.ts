import type { CommandDef } from "./registry.js";

/**
 * Column width that always leaves a gap, even when the longest name overflows
 * the preferred width — otherwise a long name runs into its description.
 */
function columnWidth(names: string[], preferred: number): number {
	const longest = names.reduce((max, n) => Math.max(max, n.length), 0);
	return Math.max(preferred, longest + 2);
}

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

	const nameWidth = columnWidth(
		commands.map((c) => c.name),
		28,
	);

	for (const [category, cmds] of grouped) {
		lines.push(`${category}:`);
		for (const cmd of cmds) {
			lines.push(`  ${cmd.name.padEnd(nameWidth)}${cmd.description}`);
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
		const width = columnWidth(Object.keys(cmd.params), 24);
		for (const [name, def] of Object.entries(cmd.params)) {
			const req = def.required ? " (required)" : "";
			const dflt =
				def.default !== undefined ? ` [default: ${def.default}]` : "";
			const enm = def.enum ? ` [choices: ${def.enum.join(", ")}]` : "";
			lines.push(`  --${name.padEnd(width)}${def.description}${req}${dflt}${enm}`);
		}
	} else {
		lines.push("No parameters.");
	}

	console.log(lines.join("\n"));
}
