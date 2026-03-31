/**
 * Cloze Parser Service
 * Pure functions for parsing Anki-style cloze deletion syntax: {{c1::text}} and {{c1::text::hint}}
 */

export interface ClozeCard {
	clozeIndex: number;
	question: string;
	answer: string;
}

const CLOZE_REGEX = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;

export function hasClozeContent(text: string): boolean {
	// Must reset lastIndex because CLOZE_REGEX has the /g flag,
	// which causes .test() to advance lastIndex between calls
	CLOZE_REGEX.lastIndex = 0;
	return CLOZE_REGEX.test(text);
}

export function extractClozeIndices(template: string): number[] {
	const indices = new Set<number>();
	const regex = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
	for (
		let match = regex.exec(template);
		match !== null;
		match = regex.exec(template)
	) {
		const indexStr = match[1];
		if (indexStr) {
			indices.add(parseInt(indexStr, 10));
		}
	}
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
	const regex = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
	return template.replace(
		regex,
		(_match, indexStr: string, text: string, hint?: string) => {
			const idx = parseInt(indexStr, 10);
			if (idx === targetIndex) {
				return hint ? `[${hint}]` : "[...]";
			}
			return text;
		},
	);
}

/**
 * Render the answer side of a cloze card.
 * Target index clozes are shown bold, other clozes are revealed normally.
 */
export function renderClozeAnswer(
	template: string,
	targetIndex: number,
): string {
	const regex = new RegExp(CLOZE_REGEX.source, CLOZE_REGEX.flags);
	return template.replace(regex, (_match, indexStr: string, text: string) => {
		const idx = parseInt(indexStr, 10);
		if (idx === targetIndex) {
			return `**${text}**`;
		}
		return text;
	});
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
