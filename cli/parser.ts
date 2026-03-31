import type { ParamDef } from "./registry.js";

export function parseArgs(
	argv: string[],
	paramDefs?: Record<string, ParamDef>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	let i = 0;

	while (i < argv.length) {
		const arg = argv[i]!;

		if (!arg.startsWith("--")) {
			i++;
			continue;
		}

		let key: string;
		let value: string | undefined;

		const eqIdx = arg.indexOf("=");
		if (eqIdx !== -1) {
			key = arg.slice(2, eqIdx);
			value = arg.slice(eqIdx + 1);
		} else {
			key = arg.slice(2);
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("--")) {
				value = next;
				i++;
			}
		}

		const def = paramDefs?.[key];
		if (value === undefined) {
			// Boolean flag with no value
			result[key] = true;
		} else if (def) {
			result[key] = coerce(value, def);
		} else {
			result[key] = tryAutoCoerce(value);
		}

		i++;
	}

	// Apply defaults for missing params
	if (paramDefs) {
		for (const [k, def] of Object.entries(paramDefs)) {
			if (result[k] === undefined && def.default !== undefined) {
				result[k] = def.default;
			}
		}
	}

	return result;
}

function coerce(value: string, def: ParamDef): unknown {
	switch (def.type) {
		case "number":
			return Number(value);
		case "boolean":
			return value === "true" || value === "1";
		case "json":
			return JSON.parse(value);
		default:
			return value;
	}
}

function tryAutoCoerce(value: string): unknown {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;

	// Try JSON for arrays/objects
	if (value.startsWith("[") || value.startsWith("{")) {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}

	// Try number
	const n = Number(value);
	if (!Number.isNaN(n) && value.trim() !== "") return n;

	return value;
}
