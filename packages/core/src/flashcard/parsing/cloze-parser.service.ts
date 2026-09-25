/**
 * Cloze Parser Service
 * Pure functions for parsing Anki-style cloze deletion syntax: {{c1::text}} and {{c1::text::hint}}
 *
 * The scanner is brace-aware: a cloze may contain balanced braces, so
 * `{{c1::{name}}}` and `{{c1::$\frac{a}{b}$}}` both parse. When the braces
 * inside a cloze do not balance (e.g. a lone `\{` in LaTeX), the cloze ends at
 * the first `}}`, as it did with the old regex parser.
 */

export interface ClozeCard {
	clozeIndex: number;
	question: string;
	answer: string;
}

export interface ClozeMatch {
	index: number;
	/** Text inside the cloze, before the hint separator. May contain nested clozes. */
	content: string;
	hint?: string;
	/** Position of the opening `{{`. */
	start: number;
	/** Position just after the closing `}}`. */
	end: number;
}

const CLOZE_OPEN = /^\{\{c(\d+)::/;

function readOpening(
	text: string,
	start: number,
): { index: number; bodyStart: number } | null {
	const match = CLOZE_OPEN.exec(text.slice(start, start + 24));
	if (!match?.[1]) return null;
	return {
		index: Number.parseInt(match[1], 10),
		bodyStart: start + match[0].length,
	};
}

/**
 * Find where the cloze body starting at `bodyStart` ends: the position of the
 * closing `}}` and of the first top-level `::` (hint separator).
 * With `balanced`, single braces must pair up before `}}` can close the cloze.
 */
function scanBody(
	text: string,
	bodyStart: number,
	balanced: boolean,
): { close: number; hintSep: number } | null {
	let j = bodyStart;
	let nested = 0; // open `{{` pairs inside the body (nested clozes)
	let single = 0; // open lone `{` inside the body
	let hintSep = -1;

	while (j < text.length) {
		if (text.startsWith("{{", j)) {
			nested++;
			j += 2;
		} else if (text.startsWith("}}", j) && single === 0) {
			if (nested === 0) return { close: j, hintSep };
			nested--;
			j += 2;
		} else if (balanced && text[j] === "{") {
			single++;
			j++;
		} else if (balanced && text[j] === "}" && single > 0) {
			single--;
			j++;
		} else if (
			hintSep === -1 &&
			nested === 0 &&
			single === 0 &&
			text.startsWith("::", j)
		) {
			hintSep = j;
			j += 2;
		} else {
			j++;
		}
	}
	return null;
}

function parseClozeAt(text: string, start: number): ClozeMatch | null {
	const opening = readOpening(text, start);
	if (!opening) return null;

	const scan =
		scanBody(text, opening.bodyStart, true) ??
		scanBody(text, opening.bodyStart, false);
	if (!scan) return null;

	const { close, hintSep } = scan;
	const contentEnd = hintSep === -1 ? close : hintSep;
	return {
		index: opening.index,
		content: text.slice(opening.bodyStart, contentEnd),
		hint: hintSep === -1 ? undefined : text.slice(hintSep + 2, close),
		start,
		end: close + 2,
	};
}

/**
 * Find the top-level clozes in `text`, left to right.
 * A cloze nested inside another one stays part of the outer `content`.
 */
export function findClozes(text: string): ClozeMatch[] {
	const matches: ClozeMatch[] = [];
	let i = text.indexOf("{{c");
	while (i !== -1) {
		const match = parseClozeAt(text, i);
		if (match) {
			matches.push(match);
			i = text.indexOf("{{c", match.end);
		} else {
			i = text.indexOf("{{c", i + 1);
		}
	}
	return matches;
}

function replaceClozes(
	text: string,
	render: (match: ClozeMatch) => string,
): string {
	const matches = findClozes(text);
	if (matches.length === 0) return text;

	let result = "";
	let last = 0;
	for (const match of matches) {
		result += text.slice(last, match.start) + render(match);
		last = match.end;
	}
	return result + text.slice(last);
}

export function hasClozeContent(text: string): boolean {
	return findClozes(text).length > 0;
}

export function extractClozeIndices(template: string): number[] {
	const indices = new Set(findClozes(template).map((match) => match.index));
	return [...indices].sort((a, b) => a - b);
}

/**
 * Render the question side of a cloze card.
 * Target index clozes become [...] or [hint], other clozes are revealed.
 */
export function renderClozeQuestion(
	template: string,
	targetIndex: number,
): string {
	return replaceClozes(template, (match) => {
		if (match.index === targetIndex) {
			return match.hint ? `[${match.hint}]` : "[...]";
		}
		return renderClozeQuestion(match.content, targetIndex);
	});
}

/**
 * Render the answer side of a cloze card.
 * Target index clozes are shown bold, other clozes are revealed normally.
 */
export function renderClozeAnswer(
	template: string,
	targetIndex: number,
): string {
	return replaceClozes(template, (match) => {
		const inner = renderClozeAnswer(match.content, targetIndex);
		return match.index === targetIndex ? `**${inner}**` : inner;
	});
}

/** Replace every cloze with its revealed text; hints are dropped. */
export function revealClozes(text: string): string {
	return replaceClozes(text, (match) => revealClozes(match.content));
}

/**
 * Parse a cloze template into individual cards, one per unique cN index.
 */
export function parseClozeTemplate(template: string): ClozeCard[] {
	const indices = extractClozeIndices(template);
	return indices.map((clozeIndex) => ({
		clozeIndex,
		question: renderClozeQuestion(template, clozeIndex),
		answer: renderClozeAnswer(template, clozeIndex),
	}));
}
