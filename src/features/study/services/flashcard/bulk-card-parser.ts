/**
 * Bulk Card Parser — multi-format text → ParsedCard[] conversion.
 *
 * Designed for the Quick tab in the Add Flashcards modal: users paste
 * text from ChatGPT, NotebookLM, or type it manually.
 *
 * Auto-detection order (first match wins):
 * 1. Tab-separated: `Front\tBack` (one pair per line)
 * 2. Q/A blocks: `Q: ...\nA: ...` — checked before :: because Q: is more distinctive
 * 3. Double-colon: `Front :: Back` (one pair per line, also catches standalone cloze)
 *
 * Cloze detection runs independently: any line containing {{c\d+::...}}
 * is treated as a Cloze card regardless of the format detected above.
 *
 * When `ParseOptions.noteType` is provided (Import Studio mode):
 * - NoteType fields are used as column names for tab-separated parsing
 * - Cloze auto-detection is restricted to noteType.type === 1
 * - Backward-compatible: omitting options preserves original behavior
 */

import type { NoteType } from "@shared/types/note.types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_CLOZE_ID,
} from "@shared/types/note.types";

// ── Types ─────────────────────────────────────────────────────

export interface ParsedCard {
	noteTypeId: string;
	fields: Record<string, string>;
}

export interface BulkParseResult {
	cards: ParsedCard[];
	/** Which format was detected (for UI display) */
	detectedFormat: "tab" | "double-colon" | "qa" | "mixed" | "none";
}

export interface ParseOptions {
	/**
	 * When provided, the parser maps columns to this NoteType's field names
	 * and restricts cloze auto-detection to cloze NoteTypes (type === 1).
	 */
	noteType: NoteType;
}

// ── Regex patterns ────────────────────────────────────────────

const CLOZE_PATTERN = /\{\{c\d+::/;

// Q: or Q : at line start (case-insensitive)
const QA_QUESTION_RE = /^Q\s*:\s*(.+)/i;
const QA_ANSWER_RE = /^A\s*:\s*(.*)/i;

// :: separator not inside cloze braces {{c1::text}}
const DOUBLE_COLON_RE = /^(.+?)(?<!\{[^}]*)::(?![^{]*\}\})(.+)$/;

// ── Main parser ───────────────────────────────────────────────

export function parseBulkText(
	text: string,
	options?: ParseOptions,
): BulkParseResult {
	const trimmed = text.trim();
	if (!trimmed) {
		return { cards: [], detectedFormat: "none" };
	}

	const lines = trimmed.split("\n");

	if (options?.noteType) {
		return parseBulkTextWithNoteType(lines, options.noteType);
	}

	// Legacy path — original behavior preserved
	const tabCards = parseTabSeparated(lines);
	if (tabCards.length > 0) {
		return { cards: tabCards, detectedFormat: "tab" };
	}

	const qaCards = parseQAFormat(lines);
	if (qaCards.length > 0) {
		return { cards: qaCards, detectedFormat: "qa" };
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
): BulkParseResult {
	// Cloze NoteTypes: detect cloze patterns, map to Text/Extra fields
	if (noteType.type === 1) {
		const cards = parseClozeLines(lines, noteType);
		return {
			cards,
			detectedFormat: cards.length > 0 ? "double-colon" : "none",
		};
	}

	// Tab-separated works for any number of fields
	const tabCards = parseTabSeparatedNField(lines, noteType);
	if (tabCards.length > 0) {
		return { cards: tabCards, detectedFormat: "tab" };
	}

	// 2-field types also support Q/A and :: formats
	if (noteType.fields.length === 2) {
		const qaCards = parseQAFormatNoteType(lines, noteType);
		if (qaCards.length > 0) {
			return { cards: qaCards, detectedFormat: "qa" };
		}

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

		if (CLOZE_PATTERN.test(trimmed)) {
			// Check for :: separator after the cloze (e.g. "{{c1::text}} :: Extra")
			const match = trimmed.match(DOUBLE_COLON_RE);
			if (match) {
				cards.push({
					noteTypeId: noteType.id,
					fields: {
						[textField]: match[1]!.trim(),
						[extraField]: match[2]!.trim(),
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
		// Must have at least as many parts as fields
		if (parts.length < fieldCount) continue;

		const fields: Record<string, string> = {};
		for (let i = 0; i < fieldCount; i++) {
			// Last field absorbs remaining columns
			const value =
				i === fieldCount - 1
					? parts.slice(i).join("\t").trim()
					: (parts[i]?.trim() ?? "");
			fields[noteType.fields[i]!] = value;
		}

		// Skip rows where any required field is empty
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

		const match = trimmed.match(DOUBLE_COLON_RE);
		if (match) {
			const v1 = match[1]!.trim();
			const v2 = match[2]!.trim();
			if (v1 && v2) {
				cards.push({ noteTypeId: noteType.id, fields: { [f1]: v1, [f2]: v2 } });
			}
		}
	}

	return cards;
}

/** Parse Q:/A: blocks for a 2-field NoteType. No cloze auto-detection. */
function parseQAFormatNoteType(
	lines: string[],
	noteType: NoteType,
): ParsedCard[] {
	const [f1, f2] = noteType.fields;
	if (!f1 || !f2) return [];

	const cards: ParsedCard[] = [];
	let currentQ: string | null = null;
	let answerLines: string[] = [];

	const flush = () => {
		if (!currentQ) return;
		const answer = answerLines.join("\n").trim();
		cards.push({
			noteTypeId: noteType.id,
			fields: { [f1]: currentQ, [f2]: answer },
		});
		currentQ = null;
		answerLines = [];
	};

	for (const line of lines) {
		const qMatch = line.match(QA_QUESTION_RE);
		if (qMatch) {
			flush();
			currentQ = qMatch[1]!.trim();
			continue;
		}
		const aMatch = line.match(QA_ANSWER_RE);
		if (aMatch && currentQ != null) {
			const text = aMatch[1]!.trim();
			if (text) answerLines.push(text);
			continue;
		}
		if (currentQ != null && answerLines.length > 0) {
			answerLines.push(line);
		}
	}

	flush();
	return cards;
}

// ── Legacy format-specific parsers ───────────────────────────

function parseTabSeparated(lines: string[]): ParsedCard[] {
	const cards: ParsedCard[] = [];
	let tabLineCount = 0;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const tabIndex = trimmed.indexOf("\t");
		if (tabIndex > 0) {
			tabLineCount++;
		}
	}

	// Require at least 1 tab-separated line and >50% of non-empty lines
	const nonEmptyLines = lines.filter((l) => l.trim()).length;
	if (tabLineCount === 0 || tabLineCount < nonEmptyLines * 0.5) {
		return [];
	}

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const tabIndex = trimmed.indexOf("\t");
		if (tabIndex <= 0) continue;

		const front = trimmed.slice(0, tabIndex).trim();
		const back = trimmed.slice(tabIndex + 1).trim();

		if (front && back) {
			cards.push(makeCard(front, back));
		}
	}

	return cards;
}

function parseDoubleColon(lines: string[]): ParsedCard[] {
	const cards: ParsedCard[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Try :: split first — handles "{{c1::X}} :: Extra info" correctly
		const match = trimmed.match(DOUBLE_COLON_RE);
		if (match) {
			const front = match[1]!.trim();
			const back = match[2]!.trim();
			if (front && back) {
				cards.push(makeCard(front, back));
				continue;
			}
		}

		// Standalone cloze line (no :: separator outside braces)
		if (CLOZE_PATTERN.test(trimmed)) {
			cards.push(makeClozeCard(trimmed));
		}
	}

	return cards;
}

function parseQAFormat(lines: string[]): ParsedCard[] {
	const cards: ParsedCard[] = [];
	let currentQuestion: string | null = null;
	let answerLines: string[] = [];

	const flush = () => {
		if (!currentQuestion) return;
		const answer = answerLines.join("\n").trim();

		if (CLOZE_PATTERN.test(currentQuestion)) {
			cards.push(makeClozeCard(currentQuestion, answer));
		} else {
			cards.push(makeCard(currentQuestion, answer));
		}

		currentQuestion = null;
		answerLines = [];
	};

	for (const line of lines) {
		const qMatch = line.match(QA_QUESTION_RE);
		if (qMatch) {
			flush();
			currentQuestion = qMatch[1]!.trim();
			continue;
		}

		const aMatch = line.match(QA_ANSWER_RE);
		if (aMatch && currentQuestion != null) {
			const text = aMatch[1]!.trim();
			if (text) answerLines.push(text);
			continue;
		}

		// Continuation lines after A:
		if (currentQuestion != null && answerLines.length > 0) {
			answerLines.push(line);
		}
	}

	flush();
	return cards;
}

// ── Card factories ────────────────────────────────────────────

function makeCard(front: string, back: string): ParsedCard {
	if (CLOZE_PATTERN.test(front)) {
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
