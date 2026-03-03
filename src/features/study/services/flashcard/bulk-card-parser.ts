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
 */

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

// ── Regex patterns ────────────────────────────────────────────

const CLOZE_PATTERN = /\{\{c\d+::/;

// Q: or Q : at line start (case-insensitive)
const QA_QUESTION_RE = /^Q\s*:\s*(.+)/i;
const QA_ANSWER_RE = /^A\s*:\s*(.*)/i;

// :: separator not inside cloze braces {{c1::text}}
const DOUBLE_COLON_RE = /^(.+?)(?<!\{[^}]*)::(?![^{]*\}\})(.+)$/;

// ── Main parser ───────────────────────────────────────────────

export function parseBulkText(text: string): BulkParseResult {
	const trimmed = text.trim();
	if (!trimmed) {
		return { cards: [], detectedFormat: "none" };
	}

	const lines = trimmed.split("\n");

	// Try tab-separated first (most structured)
	const tabCards = parseTabSeparated(lines);
	if (tabCards.length > 0) {
		return { cards: tabCards, detectedFormat: "tab" };
	}

	// Try Q:/A: format before :: (Q: is a more distinctive marker)
	const qaCards = parseQAFormat(lines);
	if (qaCards.length > 0) {
		return { cards: qaCards, detectedFormat: "qa" };
	}

	// Try double-colon format (also catches standalone cloze lines)
	const colonCards = parseDoubleColon(lines);
	if (colonCards.length > 0) {
		return { cards: colonCards, detectedFormat: "double-colon" };
	}

	return { cards: [], detectedFormat: "none" };
}

// ── Format-specific parsers ───────────────────────────────────

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
