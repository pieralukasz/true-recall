import { type ZodTypeAny, z } from "zod";

/**
 * Command-line arguments for a tool, derived from its MCP input schema so the
 * CLI and the MCP server accept exactly the same parameters. Lives next to
 * the tools because it must use the same zod copy as the schemas.
 */

type Schema = Record<string, ZodTypeAny>;

export type ParamKind =
	| "string"
	| "number"
	| "boolean"
	| "enum"
	| "array"
	| "object";

export type ParamInfo = {
	name: string;
	kind: ParamKind;
	description?: string;
	required: boolean;
	nullable: boolean;
	defaultValue?: unknown;
	choices?: string[];
	itemKind?: ParamKind;
};

export class UsageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UsageError";
	}
}

/** Peel optional/default/nullable/effects wrappers off a schema. */
function unwrap(schema: ZodTypeAny): {
	base: ZodTypeAny;
	nullable: boolean;
	defaultValue?: unknown;
	description?: string;
} {
	let s = schema;
	let nullable = false;
	let defaultValue: unknown;
	let description = schema.description;
	for (;;) {
		description ??= s.description;
		if (s instanceof z.ZodOptional) s = s.unwrap() as ZodTypeAny;
		else if (s instanceof z.ZodNullable) {
			nullable = true;
			s = s.unwrap() as ZodTypeAny;
		} else if (s instanceof z.ZodDefault) {
			defaultValue = s._def.defaultValue();
			s = s.removeDefault() as ZodTypeAny;
		} else if (s instanceof z.ZodEffects) s = s.innerType() as ZodTypeAny;
		else break;
	}
	return {
		base: s,
		nullable,
		defaultValue,
		description: description ?? s.description,
	};
}

function kindOf(base: ZodTypeAny): ParamKind {
	if (base instanceof z.ZodString) return "string";
	if (base instanceof z.ZodNumber) return "number";
	if (base instanceof z.ZodBoolean) return "boolean";
	if (base instanceof z.ZodEnum) return "enum";
	if (base instanceof z.ZodArray) return "array";
	return "object";
}

export function describeParams(schema: Schema | undefined): ParamInfo[] {
	if (!schema) return [];
	return Object.entries(schema).map(([name, s]) => {
		const { base, nullable, defaultValue, description } = unwrap(s);
		const kind = kindOf(base);
		const info: ParamInfo = {
			name,
			kind,
			description,
			required: !s.isOptional(),
			nullable,
		};
		if (defaultValue !== undefined) info.defaultValue = defaultValue;
		if (base instanceof z.ZodEnum)
			info.choices = [...(base.options as string[])];
		if (base instanceof z.ZodArray)
			info.itemKind = kindOf(unwrap(base.element as ZodTypeAny).base);
		return info;
	});
}

function coerceScalar(raw: string, kind: ParamKind | undefined): unknown {
	if (kind === "number") {
		const n = Number(raw);
		return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
	}
	if (kind === "boolean") {
		if (["true", "1", "yes"].includes(raw)) return true;
		if (["false", "0", "no"].includes(raw)) return false;
	}
	return raw;
}

function coerce(raw: string, p: ParamInfo): unknown {
	if (p.nullable && raw === "null") return null;
	if (p.kind === "array") {
		if (raw.trimStart().startsWith("[")) return parseJson(raw, p.name);
		return raw.split(",").map((part) => coerceScalar(part.trim(), p.itemKind));
	}
	if (p.kind === "object") return parseJson(raw, p.name);
	return coerceScalar(raw, p.kind);
}

function parseJson(raw: string, name: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		throw new UsageError(`--${name} expects JSON, got: ${raw}`);
	}
}

export type ParsedArgv = {
	params: Record<string, unknown>;
	port?: number;
	pretty?: boolean;
};

/**
 * Parse `--name value`, `--name=value` and bare boolean flags. Flags may use
 * dashes (`--card-id`) or underscores. `--json '{...}'` supplies several
 * params at once; explicit flags win over it.
 */
export function parseArgv(
	argv: string[],
	schema: Schema | undefined,
): ParsedArgv {
	const infos = new Map(describeParams(schema).map((p) => [p.name, p]));
	const out: ParsedArgv = { params: {} };
	const flags: Record<string, unknown> = {};
	let jsonParams: Record<string, unknown> = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith("--")) {
			throw new UsageError(
				`Unexpected argument '${arg}'. Pass parameters as --name value.`,
			);
		}
		const eq = arg.indexOf("=");
		const rawKey = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
		const key = rawKey.replaceAll("-", "_");
		let value: string | undefined = eq === -1 ? undefined : arg.slice(eq + 1);
		const info = infos.get(key);
		const takesValue =
			key === "port" || key === "json" || (info && info.kind !== "boolean");
		const next = argv[i + 1];
		if (value === undefined && next !== undefined && !next.startsWith("--")) {
			if (
				takesValue ||
				(info?.kind === "boolean" && /^(true|false|1|0|yes|no)$/.test(next))
			) {
				value = next;
				i++;
			}
		}

		if (key === "pretty") {
			out.pretty = value === undefined ? true : value !== "false";
			continue;
		}
		if (key === "port") {
			const port = Number(value);
			if (!Number.isInteger(port) || port <= 0)
				throw new UsageError("--port expects a port number");
			out.port = port;
			continue;
		}
		if (key === "json") {
			if (value === undefined)
				throw new UsageError("--json expects a JSON object");
			const parsed = parseJson(value, "json");
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				throw new UsageError("--json expects a JSON object");
			}
			jsonParams = parsed as Record<string, unknown>;
			continue;
		}
		if (!info) {
			const known = [...infos.keys()].map((k) => `--${k}`).join(", ");
			throw new UsageError(
				`Unknown parameter --${rawKey}.${known ? ` Valid: ${known}.` : " This command takes no parameters."}`,
			);
		}
		if (value === undefined) {
			if (info.kind !== "boolean")
				throw new UsageError(`--${key} needs a value`);
			flags[key] = true;
		} else {
			flags[key] = coerce(value, info);
		}
	}

	out.params = { ...jsonParams, ...flags };
	return out;
}

/** Validate against the tool schema; returns parsed params with defaults applied. */
export function validateParams(
	schema: Schema | undefined,
	params: Record<string, unknown>,
): Record<string, unknown> {
	const result = z
		.object(schema ?? {})
		.strict()
		.safeParse(params);
	if (result.success) return result.data;
	const problems = result.error.issues.map((issue) => {
		const where =
			issue.path.length > 0 ? `--${issue.path.join(".")}` : "parameters";
		return `${where}: ${issue.message}`;
	});
	throw new UsageError(`Invalid parameters:\n  ${problems.join("\n  ")}`);
}
