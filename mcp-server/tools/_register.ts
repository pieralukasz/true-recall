import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { TrueRecallClient } from "../client.js";

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
	handle(params: Params, client: TrueRecallClient): Promise<ToolResult>;
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export const jsonResult = (data: unknown): ToolResult => ({
	content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

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
	for (const { name, description, inputSchema, handle } of tools) {
		if (inputSchema) {
			server.registerTool(name, { description, inputSchema }, (params) =>
				handle(params as Params, client),
			);
		} else {
			server.registerTool(name, { description }, () => handle({}, client));
		}
	}
}
