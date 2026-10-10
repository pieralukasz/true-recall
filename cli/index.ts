#!/usr/bin/env bun

/**
 * true-recall CLI. Every command is an MCP tool from mcp-server/server.ts, so
 * the CLI and the MCP server share names, parameters, validation and
 * descriptions. `true-recall mcp` runs the MCP server itself over stdio.
 */
import {
	describeParams,
	parseArgv,
	UsageError,
	validateParams,
} from "../mcp-server/cli-args.js";
import { TrueRecallClient } from "../mcp-server/client.js";
import { explainError } from "../mcp-server/errors.js";
import {
	ALL_TOOLS,
	SERVER_VERSION,
	serveStdio,
	TOOL_GROUPS,
} from "../mcp-server/server.js";
import { hintLabel } from "../mcp-server/tools/_hints.js";
import type { ToolDef } from "../mcp-server/tools/_register.js";

const EXIT_API_ERROR = 1;
const EXIT_USAGE = 2;

const toolMap = new Map(ALL_TOOLS.map((t) => [t.name, t]));

function print(data: unknown, pretty: boolean): void {
	console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
}

function fail(
	payload: Record<string, unknown>,
	code: number,
	pretty: boolean,
): never {
	console.error(
		pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload),
	);
	process.exit(code);
}

function globalHelp(): string {
	const lines = [
		`true-recall ${SERVER_VERSION}: command-line access to the True Recall Obsidian plugin`,
		"",
		"Usage:",
		"  true-recall <command> [--param value ...]",
		"  true-recall <command> --help     parameters of one command",
		"  true-recall mcp                  run the MCP server over stdio",
		"",
		"Output is JSON on stdout (compact unless stdout is a terminal or --pretty is set).",
		"Errors are JSON on stderr: exit 1 for API errors, 2 for bad usage.",
		"",
	];
	for (const [group, tools] of TOOL_GROUPS) {
		lines.push(`${group}:`);
		for (const t of tools) {
			const label = hintLabel(t.name);
			lines.push(
				`  ${t.name.padEnd(30)}${label === "read-only" ? "" : `[${label}] `}${firstSentence(t.description)}`,
			);
		}
		lines.push("");
	}
	lines.push(
		"Options:",
		"  --port <n>       Local API port (default: TRUE_RECALL_PORT or 27182)",
		"  --json '<obj>'   Pass parameters as one JSON object",
		"  --pretty         Indent the JSON output",
		"  --version        Print the version",
		"",
		"Environment:",
		"  TRUE_RECALL_TOKEN  Token from Obsidian: Settings → True Recall → Integrations → Local API",
		"  TRUE_RECALL_PORT   Local API port",
		"",
		"Examples:",
		"  true-recall get_full_context",
		"  true-recall list_cards --state review --limit 10",
		"  true-recall set_note_preset --preset-name null --path 'Folder/Note.md'",
		'  true-recall create_flashcards_batch --json \'{"cards":[{"question":"Q","answer":"A"}]}\'',
	);
	return lines.join("\n");
}

function firstSentence(text: string): string {
	const end = text.search(/\.(\s|$)/);
	return end === -1 ? text : text.slice(0, end + 1);
}

function commandHelp(tool: ToolDef): string {
	const lines = [
		`true-recall ${tool.name}  [${hintLabel(tool.name)}]`,
		"",
		tool.description,
		"",
	];
	const params = describeParams(tool.inputSchema);
	if (params.length === 0) {
		lines.push("No parameters.");
		return lines.join("\n");
	}
	lines.push("Parameters:");
	for (const p of params) {
		const flag = `--${p.name.replaceAll("_", "-")}`;
		const type =
			p.kind === "enum"
				? (p.choices ?? []).join("|")
				: p.kind === "array"
					? `${p.itemKind ?? "value"},... or JSON array`
					: p.kind === "object"
						? "JSON object"
						: p.kind;
		const extras = [
			p.required ? "required" : undefined,
			p.nullable ? "null allowed" : undefined,
			p.defaultValue !== undefined
				? `default ${JSON.stringify(p.defaultValue)}`
				: undefined,
		].filter(Boolean);
		lines.push(
			`  ${flag} <${type}>${extras.length > 0 ? ` (${extras.join(", ")})` : ""}`,
		);
		if (p.description) lines.push(`      ${p.description}`);
	}
	return lines.join("\n");
}

/** A tool result is JSON text; hand the parsed value back for printing. */
function resultData(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const pretty = process.stdout.isTTY === true || args.includes("--pretty");
	const first = args[0];

	if (
		first === undefined ||
		first === "--help" ||
		first === "-h" ||
		first === "help"
	) {
		console.log(globalHelp());
		return;
	}
	if (first === "--version" || first === "-v" || first === "version") {
		console.log(SERVER_VERSION);
		return;
	}
	if (first === "mcp") {
		await serveStdio(new TrueRecallClient());
		return;
	}

	const tool = toolMap.get(first.replaceAll("-", "_"));
	if (!tool) {
		fail(
			{
				error: `Unknown command: ${first}`,
				hint: "Run true-recall --help for the command list.",
			},
			EXIT_USAGE,
			pretty,
		);
	}
	const rest = args.slice(1);
	if (rest.includes("--help") || rest.includes("-h")) {
		console.log(commandHelp(tool));
		return;
	}

	let params: Record<string, unknown>;
	let port: number | undefined;
	try {
		const parsed = parseArgv(rest, tool.inputSchema);
		port = parsed.port;
		params = validateParams(tool.inputSchema, parsed.params);
	} catch (error) {
		if (error instanceof UsageError) {
			fail(
				{ error: error.message, hint: `Run true-recall ${tool.name} --help` },
				EXIT_USAGE,
				pretty,
			);
		}
		throw error;
	}

	try {
		const result = await tool.handle(params, new TrueRecallClient(port));
		const text = result.content.map((c) => c.text).join("\n");
		if (result.isError) fail({ error: text }, EXIT_API_ERROR, pretty);
		print(resultData(text), pretty);
	} catch (error) {
		if (error instanceof UsageError) {
			fail(
				{ error: error.message, hint: `Run true-recall ${tool.name} --help` },
				EXIT_USAGE,
				pretty,
			);
		}
		fail({ ...explainError(error) }, EXIT_API_ERROR, pretty);
	}
}

await main();
