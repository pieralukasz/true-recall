/**
 * Designed for the Quick tab in the Add Flashcards modal: users paste
 * text or type it manually.
 *
 * Format: `Front :: Back` (one pair per line, also catches standalone cloze).
 *
 * When `ParseOptions.noteType` is provided (Import Studio mode):
 * - NoteType fields are used as column names for tab-separated parsing
 * - 2-field NoteTypes also support :: format as fallback
 * - Cloze auto-detection is restricted to noteType.type === 1
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
}

export interface BulkParseResult {
	cards: ParsedCard[];
	detectedFormat: "block" | "tab" | "double-colon" | "none";
}

export interface ParseOptions {
	/**
	 * When provided, the parser maps columns to this NoteType's field names
	 * and restricts cloze auto-detection to cloze NoteTypes (type === 1).
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

	// Tab-separated works for any number of fields (Import Studio N-field)
	const tabCards = parseTabSeparatedNField(lines, noteType);
	if (tabCards.length > 0) {
		return { cards: tabCards, detectedFormat: "tab" };
	}

	// 2-field types also support :: format
	if (noteType.fields.length === 2) {
		const colonCards = parseDoubleColonNoteType(lines, noteType);
		if (colonCards.length > 0) {
			return { cards: colonCards, detectedFormat: "double-colon" };
		}
	}

	return { cards: [], detectedFormat: "none" };
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

/**
 * Parse tab-separated lines into N-field cards.
 * Columns map to noteType.fields in order; extra columns are discarded.
 * Last field absorbs all remaining columns to handle embedded tabs.
 */
function parseTabSeparatedNField(
	lines: string[],
	noteType: NoteType,
): ParsedCard[] {
	const fieldCount = noteType.fields.length;
	if (fieldCount < 2) return [];

	const cards: ParsedCard[] = [];
	let tabLineCount = 0;
	const nonEmpty = lines.filter((l) => l.trim());

	for (const line of nonEmpty) {
		if (line.includes("\t")) tabLineCount++;
	}

	// Require >50% of non-empty lines to have tabs
	if (tabLineCount === 0 || tabLineCount < nonEmpty.length * 0.5) {
		return [];
	}

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.includes("\t")) continue;

		const parts = trimmed.split("\t");
		if (parts.length < fieldCount) continue;

		const fields: Record<string, string> = {};
		for (let i = 0; i < fieldCount; i++) {
			const value =
				i === fieldCount - 1
					? parts.slice(i).join("\t").trim()
					: (parts[i]?.trim() ?? "");
			const fieldName = noteType.fields[i];
			if (fieldName) fields[fieldName] = value;
		}

		if (Object.values(fields).some((v) => !v)) continue;

		cards.push({ noteTypeId: noteType.id, fields });
	}

	return cards;
}

/** Parse :: separated lines for a 2-field NoteType. No cloze auto-detection. */
function parseDoubleColonNoteType(
	lines: string[],
	noteType: NoteType,
): ParsedCard[] {
	const [f1, f2] = noteType.fields;
	if (!f1 || !f2) return [];

	const cards: ParsedCard[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(INLINE_SEPARATOR_RE);
		if (match) {
			const v1 = match[1]?.trim();
			const v2 = match[2]?.trim();
			if (v1 && v2) {
				cards.push({ noteTypeId: noteType.id, fields: { [f1]: v1, [f2]: v2 } });
			}
		}
	}

	return cards;
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
