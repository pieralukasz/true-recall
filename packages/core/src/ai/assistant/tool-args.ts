/**
 * Readers for assistant tool-call arguments.
 *
 * Tool arguments arrive as JSON the model wrote, so a field the tool schema
 * declares as a string can still turn up as an object or an array. Passing that
 * to `String()` yields "[object Object]" and writes it into a card field or a
 * note path, so every read narrows explicitly instead. Primitives are coerced
 * because a model answering `2` for a numeric-looking field is still usable;
 * anything structural falls back.
 */

import type { ProposalTarget } from "./assistant.types";

function coercePrimitive(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return null;
}

export function readString(
	args: Record<string, unknown>,
	key: string,
	fallback = "",
): string {
	return coercePrimitive(args[key]) ?? fallback;
}

export function readNumber(
	args: Record<string, unknown>,
	key: string,
	fallback: number,
): number {
	const value = args[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Field maps come from the model keyed by note-type field name. */
export function readStringRecord(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null) return {};
	const fields: Record<string, string> = {};
	for (const [name, raw] of Object.entries(value)) {
		const coerced = coercePrimitive(raw);
		if (coerced !== null) fields[name] = coerced;
	}
	return fields;
}

export function readStringRecordArray(
	value: unknown,
): Record<string, string>[] {
	return Array.isArray(value) ? value.map(readStringRecord) : [];
}

/**
 * Returns null when the model supplied no usable target, so the caller can tell
 * it to retry rather than record a proposal that points nowhere.
 */
export function readProposalTarget(value: unknown): ProposalTarget | null {
	if (typeof value !== "object" || value === null) return null;
	const target: Record<string, unknown> = { ...value };

	if (target.kind === "note" && typeof target.path === "string") {
		return { kind: "note", path: target.path };
	}
	if (
		target.kind === "card-field" &&
		typeof target.cardId === "string" &&
		typeof target.noteId === "string" &&
		typeof target.field === "string"
	) {
		return {
			kind: "card-field",
			cardId: target.cardId,
			noteId: target.noteId,
			field: target.field,
		};
	}
	return null;
}
