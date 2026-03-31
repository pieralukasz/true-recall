import type { TrueRecallClient } from "./client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParamDef = {
	type: "string" | "number" | "boolean" | "json";
	description: string;
	required?: boolean;
	default?: unknown;
	enum?: string[];
};

export type CommandDef = {
	name: string;
	description: string;
	category: string;
	params?: Record<string, ParamDef>;
	handle(
		params: Record<string, unknown>,
		client: TrueRecallClient,
	): Promise<unknown>;
};

type Params = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Factory functions — mirror MCP _register.ts patterns
// ---------------------------------------------------------------------------

/** Static GET, no params. */
export const get = (
	name: string,
	description: string,
	category: string,
	path: string,
): CommandDef => ({
	name,
	description,
	category,
	async handle(_p, client) {
		return client.get(path);
	},
});

/** Static POST with empty body, no params. */
export const post = (
	name: string,
	description: string,
	category: string,
	path: string,
): CommandDef => ({
	name,
	description,
	category,
	async handle(_p, client) {
		return client.post(path, {});
	},
});

/** GET where the path is built from params. */
export const getWith = (
	name: string,
	description: string,
	category: string,
	params: Record<string, ParamDef>,
	pathFn: (p: Params) => string,
): CommandDef => ({
	name,
	description,
	category,
	params,
	async handle(p, client) {
		return client.get(pathFn(p));
	},
});

/** POST forwarding all params as the JSON body. */
export const postParams = (
	name: string,
	description: string,
	category: string,
	path: string,
	params: Record<string, ParamDef>,
): CommandDef => ({
	name,
	description,
	category,
	params,
	async handle(p, client) {
		return client.post(path, p);
	},
});

/** POST with dynamic path and body derived from params. */
export const postTo = (
	name: string,
	description: string,
	category: string,
	params: Record<string, ParamDef>,
	pathFn: (p: Params) => string,
	bodyFn: (p: Params) => unknown,
): CommandDef => ({
	name,
	description,
	category,
	params,
	async handle(p, client) {
		return client.post(pathFn(p), bodyFn(p));
	},
});

/** DELETE with path derived from params. */
export const del = (
	name: string,
	description: string,
	category: string,
	params: Record<string, ParamDef>,
	pathFn: (p: Params) => string,
): CommandDef => ({
	name,
	description,
	category,
	params,
	async handle(p, client) {
		return client.delete(pathFn(p));
	},
});

/** Custom handler with params. */
export const custom = (
	name: string,
	description: string,
	category: string,
	params: Record<string, ParamDef>,
	handler: (p: Params, client: TrueRecallClient) => Promise<unknown>,
): CommandDef => ({
	name,
	description,
	category,
	params,
	handle: handler,
});

/** Custom handler without params. */
export const customNoArgs = (
	name: string,
	description: string,
	category: string,
	handler: (client: TrueRecallClient) => Promise<unknown>,
): CommandDef => ({
	name,
	description,
	category,
	async handle(_p, client) {
		return handler(client);
	},
});
