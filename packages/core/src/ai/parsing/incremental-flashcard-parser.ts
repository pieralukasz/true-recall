import type { ParsedBlock } from "../../flashcard/parsing/block-parser.service";
import { hasClozeContent } from "../../flashcard/parsing/cloze-parser.service";
import type { NoteType } from "../../types/note.types";

export interface IncrementalParseEvent {
	type: "card_complete" | "partial_update";
	block?: ParsedBlock;
	partialQuestion?: string;
	partialAnswer?: string;
}

export type NoteTypeLookup = (slug: string) => NoteType | null;

export interface ParseCardOptions {
	/**
	 * The preset intentionally produces one-sided cards (question only), so an
	 * empty answer field is valid output rather than a degenerate card.
	 */
	allowEmptyAnswer?: boolean;
}

/**
 * Non-streaming JSON parser: parse full AI response text into ParsedBlocks.
 * Handles markdown code fences and extracts the JSON array.
 */
export function parseBlockResponse(
	text: string,
	getNoteType: NoteTypeLookup,
	options?: ParseCardOptions,
): ParsedBlock[] {
	let json = text.trim();
	json = json.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

	const start = json.indexOf("[");
	const end = json.lastIndexOf("]");
	if (start === -1 || end <= start) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(json.slice(start, end + 1));
	} catch {
		return [];
	}

	if (!Array.isArray(parsed)) return [];

	return parsed
		.map((item) => parseCardObject(item, getNoteType, options))
		.filter((b): b is ParsedBlock => b !== null);
}

function parseCardObject(
	item: unknown,
	getNoteType: NoteTypeLookup,
	options?: ParseCardOptions,
): ParsedBlock | null {
	if (typeof item !== "object" || item === null) return null;
	const obj = item as Record<string, unknown>;

	const slug = typeof obj.type === "string" ? obj.type : null;
	if (!slug) return null;

	const noteType = getNoteType(slug);
	if (!noteType) return null;

	const fields: Record<string, string> = {};
	let hasContent = false;
	for (const fieldName of noteType.fields) {
		const raw = typeof obj[fieldName] === "string" ? obj[fieldName] : "";
		const value = unwrapFullHighlight(raw);
		fields[fieldName] = value;
		if (value.trim()) hasContent = true;
	}

	if (!hasContent) return null;
	if (isDegenerateCard(noteType, fields, options)) return null;

	const sourceText =
		typeof obj.source === "string" ? obj.source.trim() : undefined;

	return {
		noteTypeId: noteType.id,
		noteTypeSlug: slug,
		fields,
		sourceText: sourceText || undefined,
	};
}

/**
 * Models copying from a highlighted source sentence sometimes wrap an entire
 * field in ==…==, which renders the whole card on a highlight background.
 * Unwrap only the full-field wrap; inner highlights may be intentional.
 */
function unwrapFullHighlight(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(/^==([\s\S]+)==$/);
	if (!match?.[1] || match[1].includes("==")) return value;
	return match[1].trim();
}

/**
 * Rejects structurally broken cards the model occasionally emits:
 * - a cloze note with no {{cN::…}} markers renders a question that hides
 *   nothing and has no answer to reveal;
 * - a standard note with only its first field filled is a question with an
 *   empty answer — unless the preset opted into one-sided cards via
 *   `allowEmptyAnswer` (e.g. a "reformat the whole note into Front" preset).
 */
function isDegenerateCard(
	noteType: NoteType,
	fields: Record<string, string>,
	options?: ParseCardOptions,
): boolean {
	if (noteType.type === 1) {
		return !noteType.fields.some((name) => hasClozeContent(fields[name] ?? ""));
	}
	if (options?.allowEmptyAnswer) return false;
	if (noteType.fields.length < 2) return false;
	return noteType.fields.slice(1).every((name) => !(fields[name] ?? "").trim());
}

/**
 * Streaming JSON array parser.
 *
 * Extracts complete JSON objects from a streamed JSON array by tracking
 * brace depth and string state. Emits card_complete events as each
 * object is fully received, and partial_update events for in-progress objects.
 */
export class IncrementalFlashcardParser {
	private objectBuffer = "";
	private state: "idle" | "in_object" = "idle";
	private depth = 0;
	private inString = false;
	private escaped = false;

	constructor(
		private getNoteType: NoteTypeLookup,
		private options?: ParseCardOptions,
	) {}

	feed(chunk: string): IncrementalParseEvent[] {
		const events: IncrementalParseEvent[] = [];

		for (const char of chunk) {
			if (this.state === "idle") {
				if (char === "{") {
					this.state = "in_object";
					this.depth = 1;
					this.inString = false;
					this.escaped = false;
					this.objectBuffer = "{";
				}
				continue;
			}

			this.objectBuffer += char;

			if (this.escaped) {
				this.escaped = false;
				continue;
			}

			if (this.inString) {
				if (char === "\\") this.escaped = true;
				else if (char === '"') this.inString = false;
				continue;
			}

			if (char === '"') this.inString = true;
			else if (char === "{") this.depth++;
			else if (char === "}") {
				this.depth--;
				if (this.depth === 0) {
					const block = this.tryParseObject(this.objectBuffer);
					if (block) {
						events.push({ type: "card_complete", block });
					}
					this.state = "idle";
					this.objectBuffer = "";
				}
			}
		}

		if (this.state === "in_object" && this.objectBuffer.length > 0) {
			const partial = this.extractPartial();
			if (partial) events.push(partial);
		}

		return events;
	}

	finish(): IncrementalParseEvent[] {
		if (this.state !== "in_object" || !this.objectBuffer.length) return [];

		const buf = this.objectBuffer;
		this.state = "idle";
		this.objectBuffer = "";

		// Try closing strategies: "}", then closing an open string ('"}'),
		// then closing an open string inside a nested object ('"}}').
		for (const suffix of ["}", '"}', '"}}']) {
			const block = this.tryParseObject(buf + suffix);
			if (block) return [{ type: "card_complete", block }];
		}
		return [];
	}

	private tryParseObject(text: string): ParsedBlock | null {
		try {
			const obj: unknown = JSON.parse(text);
			return parseCardObject(obj, this.getNoteType, this.options);
		} catch {
			return null;
		}
	}

	private extractPartial(): IncrementalParseEvent | null {
		const buf = this.objectBuffer;

		const typeMatch = buf.match(/"type"\s*:\s*"([^"]+)"/);
		if (!typeMatch?.[1]) return null;
		const noteType = this.getNoteType(typeMatch[1]);
		if (!noteType) return null;

		const firstField = noteType.fields[0];
		const secondField = noteType.fields[1];

		const extract = (field: string | undefined): string | undefined => {
			if (!field) return undefined;
			const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const re = new RegExp(`"${escaped}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`);
			const m = buf.match(re);
			return m?.[1]?.trim() || undefined;
		};

		const partialQuestion = extract(firstField);
		const partialAnswer = extract(secondField);

		if (!partialQuestion && !partialAnswer) return null;
		return { type: "partial_update", partialQuestion, partialAnswer };
	}
}
