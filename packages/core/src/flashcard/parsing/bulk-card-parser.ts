/**
 * Designed for the Quick tab in the Add Flashcards modal: users paste
 * text or type it manually.
 *
 * Format: `Front :: Back` (one pair per line, also catches standalone cloze).
 *
 * When `ParseOptions.noteType` is provided (Import Studio mode):
 * - NoteType fields are used as column names for tab-separated parsing
 * - 2-field NoteTypes also support :: format as fallback
 * - Lines with cloze markers become built-in Cloze notes under any
 *   non-cloze NoteType; cloze NoteTypes keep their own field names
 */

import type { NoteType } from "@true-recall/core/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
} from "@true-recall/core/types/note.types";

import { type NoteTypeLookup, parseBlocks } from "./block-parser.service";
import { CLOZE_DETECT, INLINE_SEPARATOR_RE } from "./parsing-patterns";

// ── Types ─────────────────────────────────────────────────────

export interface ParsedCard {
	noteTypeId: string;
	fields: Record<string, string>;
	alwaysTypeIn?: boolean;
	/** Quote from a block's `<!-- source: ... -->` comment (jump-to-source). */
	sourceText?: string;
}

export interface BulkParseResult {
	cards: ParsedCard[];
	detectedFormat: "block" | "tab" | "double-colon" | "none";
}

export interface ParseOptions {
	/**
	 * When provided, the parser maps columns to this NoteType's field names.
	 * Cloze lines become built-in Cloze notes unless this is a cloze type.
	 */
	noteType?: NoteType;
	/** Required for block format parsing (#type/<slug>) */
	getNoteType?: NoteTypeLookup;
}

// ── Main parser ───────────────────────────────────────────────

export function parseBulkText(
	text: string,
	options?: ParseOptions,
): BulkParseResult {
	const trimmed = text.trim();
	if (!trimmed) {
		return { cards: [], detectedFormat: "none" };
	}

	// Block format auto-detection: if text contains #type/, try block parser first
	if (trimmed.includes("#type/") && options?.getNoteType) {
		const { blocks } = parseBlocks(trimmed, options.getNoteType);
		if (blocks.length > 0) {
			return {
				cards: blocks.map((b) => ({
					noteTypeId: b.noteTypeId,
					fields: b.fields,
					alwaysTypeIn: b.alwaysTypeIn,
					...(b.sourceText && { sourceText: b.sourceText }),
				})),
				detectedFormat: "block",
			};
		}
	}

	const lines = trimmed.split("\n");

	if (options?.noteType) {
		return parseBulkTextWithNoteType(
			lines,
			options.noteType,
			options.getNoteType,
		);
	}

	const colonCards = parseDoubleColon(lines);
	if (colonCards.length > 0) {
		return { cards: colonCards, detectedFormat: "double-colon" };
	}

	return { cards: [], detectedFormat: "none" };
}

// ── NoteType-aware path ───────────────────────────────────────

function parseBulkTextWithNoteType(
	lines: string[],
	noteType: NoteType,
	_getNoteType?: NoteTypeLookup,
): BulkParseResult {
	// Cloze NoteTypes: detect cloze patterns, map to Text/Extra fields
	if (noteType.type === 1) {
		const cards = parseClozeLines(lines, noteType);
		return {
			cards,
			detectedFormat: cards.length > 0 ? "double-colon" : "none",
		};
	}

	// A line with cloze markers is a Cloze note whatever the selected type:
	// splitting `{{c1::a}}` on its inner `::` or mapping it to Front/Back
	// would store raw cloze syntax on a Basic card.
	const nonCloze = lines.filter((l) => !CLOZE_DETECT.test(l.trim()));
	// Format for the non-cloze lines; only 2-field types support `::`
	let format: "tab" | "double-colon" | null = null;
	if (isTabSeparated(nonCloze, noteType)) format = "tab";
	else if (noteType.fields.length === 2) format = "double-colon";

	const cards: ParsedCard[] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		if (CLOZE_DETECT.test(trimmed)) {
			cards.push(parseStandaloneClozeLine(trimmed, format === "tab"));
			continue;
		}

		const card =
			format === "tab"
				? parseTabLine(trimmed, noteType)
				: format === "double-colon"
					? parseDoubleColonLine(trimmed, noteType)
					: null;
		if (card) cards.push(card);
	}

	if (cards.length === 0) return { cards, detectedFormat: "none" };
	return { cards, detectedFormat: format ?? "double-colon" };
}

/** Cloze line under a non-cloze NoteType → built-in Cloze note (Text/Extra). */
function parseStandaloneClozeLine(
	line: string,
	tabFormat: boolean,
): ParsedCard {
	if (tabFormat && line.includes("\t")) {
		const [text = "", ...rest] = line.split("\t");
		return makeClozeCard(text.trim(), rest.join("\t").trim());
	}
	const match = line.match(INLINE_SEPARATOR_RE);
	if (match) {
		return makeClozeCard(match[1]?.trim() ?? "", match[2]?.trim() ?? "");
	}
	return makeClozeCard(line);
}

/** Parse cloze NoteType lines. Maps to Text/Extra using the NoteType's field names. */
function parseClozeLines(lines: string[], noteType: NoteType): ParsedCard[] {
	const cards: ParsedCard[] = [];
	const textField = noteType.fields[0] ?? "Text";
	const extraField = noteType.fields[1] ?? "Extra";

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		if (CLOZE_DETECT.test(trimmed)) {
			const match = trimmed.match(INLINE_SEPARATOR_RE);
			if (match) {
				cards.push({
					noteTypeId: noteType.id,
					fields: {
						[textField]: match[1]?.trim() ?? "",
						[extraField]: match[2]?.trim() ?? "",
					},
				});
			} else {
				cards.push({
					noteTypeId: noteType.id,
					fields: { [textField]: trimmed, [extraField]: "" },
				});
			}
		}
	}

	return cards;
}

/** Tab format needs a 2+ field type and tabs on more than half the non-empty lines. */
function isTabSeparated(lines: string[], noteType: NoteType): boolean {
	if (noteType.fields.length < 2) return false;
	const nonEmpty = lines.filter((l) => l.trim());
	const tabLineCount = nonEmpty.filter((l) => l.includes("\t")).length;
	return tabLineCount > 0 && tabLineCount >= nonEmpty.length * 0.5;
}

/**
 * Parse one tab-separated line into an N-field card.
 * Columns map to noteType.fields in order; the last field absorbs all
 * remaining columns to handle embedded tabs.
 */
function parseTabLine(line: string, noteType: NoteType): ParsedCard | null {
	if (!line.includes("\t")) return null;
	const fieldCount = noteType.fields.length;
	const parts = line.split("\t");
	if (parts.length < fieldCount) return null;

	const fields: Record<string, string> = {};
	for (let i = 0; i < fieldCount; i++) {
		const value =
			i === fieldCount - 1
				? parts.slice(i).join("\t").trim()
				: (parts[i]?.trim() ?? "");
		const fieldName = noteType.fields[i];
		if (fieldName) fields[fieldName] = value;
	}

	if (Object.values(fields).some((v) => !v)) return null;
	return { noteTypeId: noteType.id, fields };
}

/** Parse one `::` separated line for a 2-field NoteType. */
function parseDoubleColonLine(
	line: string,
	noteType: NoteType,
): ParsedCard | null {
	const [f1, f2] = noteType.fields;
	if (!f1 || !f2) return null;

	const match = line.match(INLINE_SEPARATOR_RE);
	const v1 = match?.[1]?.trim();
	const v2 = match?.[2]?.trim();
	if (!v1 || !v2) return null;
	return { noteTypeId: noteType.id, fields: { [f1]: v1, [f2]: v2 } };
}

// ── Format-specific parsers ──────────────────────────────────

function parseDoubleColon(lines: string[]): ParsedCard[] {
	const cards: ParsedCard[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(INLINE_SEPARATOR_RE);
		if (match) {
			const front = match[1]?.trim();
			const back = match[2]?.trim();
			if (front && back) {
				cards.push(makeCard(front, back));
				continue;
			}
		}

		// Standalone cloze line (no :: separator outside braces)
		if (CLOZE_DETECT.test(trimmed)) {
			cards.push(makeClozeCard(trimmed));
		}
	}

	return cards;
}

// ── Card factories ────────────────────────────────────────────

function makeCard(front: string, back: string): ParsedCard {
	if (CLOZE_DETECT.test(front)) {
		return makeClozeCard(front, back);
	}

	return {
		noteTypeId: BUILTIN_BASIC_ID,
		fields: { Front: front, Back: back },
	};
}

function makeClozeCard(text: string, extra = ""): ParsedCard {
	return {
		noteTypeId: BUILTIN_CLOZE_ID,
		fields: { Text: text, Extra: extra },
	};
}
