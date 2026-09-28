import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

import type { TrueRecallClient } from "../client.js";
import { formatError } from "../errors.js";
import { hintsFor, type ToolHints } from "./_hints.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Params = Record<string, unknown>;
type Schema = Record<string, z.ZodType>;

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

export type ToolDef = {
	name: string;
	description: string;
	inputSchema?: Schema;
	// Property syntax (not method shorthand) so destructuring `handle` out of
	// a ToolDef and calling it elsewhere isn't treated as an unbound method
	// reference — it's a plain function value, never uses `this`.
	handle: (params: Params, client: TrueRecallClient) => Promise<ToolResult>;
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/** Compact JSON: indentation costs the model tokens and adds no information. */
export const jsonResult = (data: unknown): ToolResult => ({
	content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

/**
 * Params are validated against a tool's inputSchema by the MCP SDK before
 * `handle`/`pathFn` runs, but that validation isn't reflected in Params'
 * static type. Use this instead of casting when a pathFn needs a param as
 * a string — it fails loudly rather than risking a "[object Object]" URL.
 */
export function requireStringParam(params: Params, key: string): string {
	const value = params[key];
	if (typeof value !== "string") {
		throw new Error(`Expected param "${key}" to be a string`);
	}
	return value;
}

/** `path?k=v&...` from the params that are set; undefined, null and false are left out. */
export function withQuery(
	path: string,
	query: Record<string, unknown>,
): string {
	const sp = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === false) continue;
		sp.set(key, String(value));
	}
	const qs = sp.toString();
	return qs ? `${path}?${qs}` : path;
}

export const errorResult = (message: string): ToolResult => ({
	content: [{ type: "text" as const, text: message }],
	isError: true,
});

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** Static GET, no params. */
export const get = (
	name: string,
	description: string,
	path: string,
): ToolDef => ({
	name,
	description,
	async handle(_p, client) {
		return jsonResult(await client.get(path));
	},
});

/** Static POST with empty body, no params. */
export const post = (
	name: string,
	description: string,
	path: string,
): ToolDef => ({
	name,
	description,
	async handle(_p, client) {
		return jsonResult(await client.post(path, {}));
	},
});

/** GET where the path is built from params. */
export const getWith = (
	name: string,
	description: string,
	inputSchema: Schema,
	pathFn: (p: Params) => string,
): ToolDef => ({
	name,
	description,
	inputSchema,
	async handle(params, client) {
		return jsonResult(await client.get(pathFn(params)));
	},
});

/** POST forwarding all params as the JSON body. */
export const postParams = (
	name: string,
	description: string,
	path: string,
	inputSchema: Schema,
): ToolDef => ({
	name,
	description,
	inputSchema,
	async handle(params, client) {
		return jsonResult(await client.post(path, params));
	},
});

/** POST with dynamic path and body derived from params. */
export const postTo = (
	name: string,
	description: string,
	inputSchema: Schema,
	pathFn: (p: Params) => string,
	bodyFn: (p: Params) => unknown,
): ToolDef => ({
	name,
	description,
	inputSchema,
	async handle(params, client) {
		return jsonResult(await client.post(pathFn(params), bodyFn(params)));
	},
});

/** DELETE with path derived from params. */
export const del = (
	name: string,
	description: string,
	inputSchema: Schema,
	pathFn: (p: Params) => string,
): ToolDef => ({
	name,
	description,
	inputSchema,
	async handle(params, client) {
		return jsonResult(await client.delete(pathFn(params)));
	},
});

/** Custom handler with schema. */
export const custom = (
	name: string,
	description: string,
	inputSchema: Schema,
	handler: (params: Params, client: TrueRecallClient) => Promise<ToolResult>,
): ToolDef => ({
	name,
	description,
	inputSchema,
	handle: handler,
});

/** Custom handler without schema. */
export const customNoArgs = (
	name: string,
	description: string,
	handler: (client: TrueRecallClient) => Promise<ToolResult>,
): ToolDef => ({
	name,
	description,
	async handle(_p, client) {
		return handler(client);
	},
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerTools(
	server: McpServer,
	client: TrueRecallClient,
	tools: ToolDef[],
): void {
	// ToolDef deliberately erases each schema to a common runtime shape. Keep
	// that erasure at the SDK boundary too, otherwise TypeScript recursively
	// expands every Zod schema in the complete tool registry.
	const registerTool = server.registerTool.bind(server) as unknown as (
		name: string,
		config: {
			title: string;
			description: string;
			inputSchema?: Schema;
			annotations: ToolHints & { title: string };
		},
		handler: (params: Params) => Promise<ToolResult>,
	) => void;

	const seen = new Set<string>();
	for (const { name, description, inputSchema, handle } of tools) {
		if (seen.has(name)) throw new Error(`Duplicate MCP tool: ${name}`);
		seen.add(name);
		const title = toolTitle(name);
		const config = {
			title,
			description,
			annotations: { title, ...hintsFor(name) },
			...(inputSchema ? { inputSchema } : {}),
		};
		// API failures come back as a tool error with the status, code and a
		// hint, instead of a bare protocol error the model can't act on.
		registerTool(name, config, async (params) => {
			try {
				return await handle(inputSchema ? params : {}, client);
			} catch (error) {
				return errorResult(formatError(error));
			}
		});
	}
}

/** "get_due_cards" -> "Get due cards" */
export function toolTitle(name: string): string {
	const words = name.split("_").join(" ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}
