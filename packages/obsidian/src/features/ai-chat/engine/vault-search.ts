/**
 * Plain-text search over the vault's notes for the AI chat: titles, aliases,
 * tags, headings and the note text. No embeddings, so it works on phones and
 * sends nothing anywhere; ranking is term-based.
 *
 * Notes are folded (lower case, no diacritics) once per file version by
 * `prepareNote`; a search then only scans the folded strings.
 */

const MARKS_RE = /\p{Mark}/gu;
const SNIPPET_RADIUS = 90;
const MAX_SNIPPETS = 2;

export interface SearchableNote {
	path: string;
	title: string;
	aliases: string[];
	tags: string[];
	headings: string[];
	text: string;
	mtime: number;
}

/** A note ready for search: folded fields only, the original text is read again for excerpts. */
export interface PreparedNote {
	path: string;
	title: string;
	tags: string[];
	mtime: number;
	fTitle: string;
	fAliases: string;
	fTags: string;
	fHeadings: string;
	fText: string;
}

export interface NoteSearchHit {
	path: string;
	title: string;
	tags: string[];
	score: number;
}

/** Lower case, no diacritics, single spaces: "Zażółć" and "zazolc" match. */
export function foldText(value: string): string {
	return value
		.replace(/[łŁ]/g, "l")
		.normalize("NFKD")
		.replace(MARKS_RE, "")
		.toLocaleLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

export function prepareNote(note: SearchableNote): PreparedNote {
	return {
		path: note.path,
		title: note.title,
		tags: note.tags,
		mtime: note.mtime,
		fTitle: foldText(note.title),
		fAliases: foldText(note.aliases.join(" ")),
		fTags: foldText(note.tags.join(" ")),
		fHeadings: foldText(note.headings.join(" ")),
		fText: foldText(note.text),
	};
}

export function queryTerms(query: string): string[] {
	return [
		...new Set(
			foldText(query)
				.split(/[\s,;:!?()"'„”]+/)
				.map((term) => term.replace(/^[#.]+|[.]+$/g, ""))
				.filter((term) => term.length >= 2),
		),
	];
}

function countOccurrences(haystack: string, needle: string, cap = 10): number {
	let count = 0;
	let from = haystack.indexOf(needle);
	while (from !== -1 && count < cap) {
		count++;
		from = haystack.indexOf(needle, from + needle.length);
	}
	return count;
}

/**
 * Score one note. Every term must appear somewhere (title, alias, tag,
 * heading or text), otherwise the note is not a hit. Title and heading
 * matches weigh more than body matches.
 */
export function scoreNote(note: PreparedNote, terms: string[]): number {
	if (terms.length === 0) return 0;
	let score = 0;
	for (const term of terms) {
		const inTitle = note.fTitle.includes(term);
		const inAlias = note.fAliases.includes(term);
		const inTag = note.fTags.includes(term);
		const inHeading = note.fHeadings.includes(term);
		const bodyCount = countOccurrences(note.fText, term);
		if (!inTitle && !inAlias && !inTag && !inHeading && bodyCount === 0)
			return 0;
		score +=
			(inTitle ? 10 : 0) +
			(inAlias ? 6 : 0) +
			(inTag ? 5 : 0) +
			(inHeading ? 4 : 0) +
			bodyCount;
	}
	if (terms.length > 1) {
		const phrase = terms.join(" ");
		if (note.fTitle.includes(phrase)) score += 15;
		else if (note.fText.includes(phrase)) score += 5;
	}
	return score;
}

/**
 * Up to two short excerpts around the first matches. Positions come from the
 * folded text; when folding kept the length (ordinary text), the excerpt is
 * cut from the original so diacritics stay.
 */
export function snippetsFor(text: string, terms: string[]): string[] {
	const collapsed = text.replace(/\s+/g, " ").trim();
	const folded = foldText(collapsed);
	const source = folded.length === collapsed.length ? collapsed : folded;
	const snippets: string[] = [];
	let lastEnd = -1;
	for (const term of terms) {
		const at = folded.indexOf(term);
		if (at === -1 || at < lastEnd) continue;
		const start = Math.max(0, at - SNIPPET_RADIUS);
		const end = Math.min(source.length, at + term.length + SNIPPET_RADIUS);
		snippets.push(
			`${start > 0 ? "…" : ""}${source.slice(start, end).trim()}${end < source.length ? "…" : ""}`,
		);
		lastEnd = end;
		if (snippets.length >= MAX_SNIPPETS) break;
	}
	return snippets;
}

export function searchNotes(
	notes: readonly PreparedNote[],
	query: string,
	limit: number,
): { total: number; terms: string[]; hits: NoteSearchHit[] } {
	const terms = queryTerms(query);
	const scored: NoteSearchHit[] = [];
	for (const note of notes) {
		const score = scoreNote(note, terms);
		if (score > 0)
			scored.push({
				path: note.path,
				title: note.title,
				tags: note.tags,
				score,
			});
	}
	scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
	return { total: scored.length, terms, hits: scored.slice(0, limit) };
}
