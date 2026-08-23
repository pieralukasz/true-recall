import { stripMarkdownSyntax } from "@true-recall/core/utils";

/**
 * Lowercased content words (length > 3) from card text, used to score
 * which note sections are relevant to the graded question.
 */
export function extractKeywords(text: string): string[] {
	const normalized = stripMarkdownSyntax(text).toLowerCase();
	const words = normalized.split(/[^\p{L}\p{N}]+/u);
	const unique = new Set(words.filter((word) => word.length > 3));
	return [...unique];
}

interface Section {
	index: number;
	text: string;
	score: number;
}

function splitIntoSections(content: string): string[] {
	const lines = content.split("\n");
	const sections: string[] = [];
	let current: string[] = [];

	for (const line of lines) {
		if (/^#{1,6}\s/.test(line) && current.length > 0) {
			sections.push(current.join("\n"));
			current = [];
		}
		current.push(line);
	}
	if (current.length > 0) sections.push(current.join("\n"));
	return sections;
}

function scoreSection(text: string, keywords: string[]): number {
	const haystack = text.toLowerCase();
	let score = 0;
	for (const keyword of keywords) {
		let from = 0;
		while (true) {
			const hit = haystack.indexOf(keyword, from);
			if (hit === -1) break;
			score++;
			from = hit + keyword.length;
		}
	}
	return score;
}

/**
 * Picks the note sections (split on markdown headings) most relevant to the
 * given keywords, re-emitted in document order, within maxChars. Falls back
 * to a head slice when the note has no headings or nothing matches.
 */
export function selectRelevantSections(
	content: string,
	keywords: string[],
	maxChars: number,
): string {
	if (content.length <= maxChars) return content;

	const parts = splitIntoSections(content);
	if (parts.length <= 1) return content.slice(0, maxChars);

	const sections: Section[] = parts.map((text, index) => ({
		index,
		text,
		score: scoreSection(text, keywords),
	}));

	const ranked = [...sections].sort(
		(a, b) => b.score - a.score || a.index - b.index,
	);

	const picked = new Set<number>();
	let used = 0;
	for (const section of ranked) {
		// Sections after the first pick must earn their place with a match.
		if (picked.size > 0 && section.score === 0) break;
		const cost = section.text.length + 1;
		if (used + cost > maxChars) {
			// Always deliver something: truncate the single best section.
			if (picked.size === 0) {
				return section.text.slice(0, maxChars);
			}
			continue;
		}
		picked.add(section.index);
		used += cost;
	}

	if (picked.size === 0) return content.slice(0, maxChars);

	return sections
		.filter((section) => picked.has(section.index))
		.map((section) => section.text)
		.join("\n");
}
