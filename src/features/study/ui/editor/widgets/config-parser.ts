/**
 * Parses codeblock source text as simple key-value config.
 *
 * Supports:
 * - `key: value` (string, number, boolean)
 * - Lines starting with `#` are comments
 * - Blank lines are ignored
 * - Unrecognized keys are silently ignored (consumer picks what it needs)
 */
export function parseCodeblockConfig(source: string): Record<string, string | number | boolean> {
	const config: Record<string, string | number | boolean> = {};
	if (!source.trim()) return config;

	for (const rawLine of source.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;

		const key = line.slice(0, colonIdx).trim();
		const raw = line.slice(colonIdx + 1).trim();
		if (!key) continue;

		config[key] = coerce(raw);
	}

	return config;
}

function coerce(value: string): string | number | boolean {
	if (value === "true") return true;
	if (value === "false") return false;

	const num = Number(value);
	if (value !== "" && !Number.isNaN(num)) return num;

	return value;
}

/** Type-safe config accessor with defaults */
export function configValue<T extends string | number | boolean>(
	config: Record<string, string | number | boolean>,
	key: string,
	defaultValue: T,
): T {
	const val = config[key];
	if (val === undefined) return defaultValue;
	return val as T;
}
