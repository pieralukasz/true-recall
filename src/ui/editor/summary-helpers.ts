import type { NoteStatusInfo } from "../../services/cache/note-status-cache.service";

export interface AggregatedStats {
	new: number;
	learning: number;
	dueToday: number;
	total: number;
	noteNames: string[];
}

export interface SectionStats {
	pos: number;
	stats: AggregatedStats;
}

export interface ScanResult {
	global: AggregatedStats | null;
	sections: SectionStats[];
}

interface HeadingInfo {
	level: number;
	lineEndPos: number;
}

const HEADING_RE = /^(#{1,6})\s/;
const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;

export function scanDocumentSections(
	docText: string,
	resolveLink: (linkText: string) => { sourceUid: string; noteName: string } | null,
	getStatus: (uid: string) => NoteStatusInfo | null,
): ScanResult {
	const lines = docText.split("\n");
	const headings: HeadingInfo[] = [];
	let charPos = 0;

	for (const line of lines) {
		const match = HEADING_RE.exec(line);
		if (match) {
			headings.push({
				level: match[1]!.length,
				lineEndPos: charPos + line.length,
			});
		}
		charPos += line.length + 1; // +1 for newline
	}

	// Determine section boundaries: each heading owns content until next heading of same/higher level
	interface Section {
		headingEndPos: number;
		startCharPos: number;
		endCharPos: number;
	}

	const sections: Section[] = [];
	for (let i = 0; i < headings.length; i++) {
		const heading = headings[i]!;
		let endPos = docText.length;
		for (let j = i + 1; j < headings.length; j++) {
			if (headings[j]!.level <= heading.level) {
				// Find the start of that heading's line
				const nextLineStart = docText.lastIndexOf("\n", headings[j]!.lineEndPos - 1) + 1;
				endPos = nextLineStart > 0 ? nextLineStart : headings[j]!.lineEndPos;
				break;
			}
		}
		sections.push({
			headingEndPos: heading.lineEndPos,
			startCharPos: heading.lineEndPos,
			endCharPos: endPos,
		});
	}

	// Scan wiki links and assign to sections
	const globalLinks: { sourceUid: string; noteName: string; status: NoteStatusInfo }[] = [];
	const sectionLinks = new Map<number, { sourceUid: string; noteName: string; status: NoteStatusInfo }[]>();
	const seen = new Set<string>();

	WIKI_LINK_RE.lastIndex = 0;
	let linkMatch: RegExpExecArray | null;
	while ((linkMatch = WIKI_LINK_RE.exec(docText)) !== null) {
		const linkText = linkMatch[1]!;
		const linkPos = linkMatch.index;

		const resolved = resolveLink(linkText);
		if (!resolved) continue;

		const status = getStatus(resolved.sourceUid);
		if (!status) continue;

		const entry = { sourceUid: resolved.sourceUid, noteName: resolved.noteName, status };

		if (!seen.has(resolved.sourceUid)) {
			seen.add(resolved.sourceUid);
			globalLinks.push(entry);
		}

		// Assign to the deepest section that contains this link position
		for (let i = sections.length - 1; i >= 0; i--) {
			const section = sections[i]!;
			if (linkPos >= section.startCharPos && linkPos < section.endCharPos) {
				if (!sectionLinks.has(i)) sectionLinks.set(i, []);
				const sectionList = sectionLinks.get(i)!;
				if (!sectionList.some((l) => l.sourceUid === resolved.sourceUid)) {
					sectionList.push(entry);
				}
				break;
			}
		}
	}

	const global = globalLinks.length >= 2 ? aggregateLinks(globalLinks) : null;

	const sectionResults: SectionStats[] = [];
	for (const [idx, links] of sectionLinks.entries()) {
		if (links.length < 2) continue;
		sectionResults.push({
			pos: sections[idx]!.headingEndPos,
			stats: aggregateLinks(links),
		});
	}
	sectionResults.sort((a, b) => a.pos - b.pos);

	return { global, sections: sectionResults };
}

function aggregateLinks(
	links: { noteName: string; status: NoteStatusInfo }[],
): AggregatedStats {
	let newCount = 0;
	let learning = 0;
	let dueToday = 0;
	let total = 0;
	const noteNames: string[] = [];

	for (const link of links) {
		newCount += link.status.new;
		learning += link.status.learning;
		dueToday += link.status.dueToday;
		total += link.status.total;
		noteNames.push(link.noteName);
	}

	return { new: newCount, learning, dueToday, total, noteNames };
}

export function aggregatedStatsEqual(a: AggregatedStats, b: AggregatedStats): boolean {
	return (
		a.new === b.new &&
		a.learning === b.learning &&
		a.dueToday === b.dueToday &&
		a.total === b.total &&
		a.noteNames.length === b.noteNames.length &&
		a.noteNames.every((n, i) => n === b.noteNames[i])
	);
}
