import type { DailyNoteInfo } from "./daily-note-detector";

const HEADING_RE = /^#{1,6}\s+(.+)$/;
const MIN_PARAGRAPH_TOKENS = 15;
const SHORT_LINE_WORD_THRESHOLD = 3;
const SHORT_LINE_RATIO = 0.5;
const MIN_LINES_FOR_DUMP_CHECK = 3;

function estimateTokens(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return Math.ceil(trimmed.split(/\s+/).length * 1.3);
}

function isLowQualityParagraph(paragraph: string): boolean {
	const tokens = estimateTokens(paragraph);
	if (tokens < MIN_PARAGRAPH_TOKENS) return true;

	const lines = paragraph.split("\n").filter((l) => l.trim());
	if (lines.length < MIN_LINES_FOR_DUMP_CHECK) return false;

	const shortLines = lines.filter(
		(l) => l.trim().split(/\s+/).length < SHORT_LINE_WORD_THRESHOLD,
	);
	return shortLines.length / lines.length > SHORT_LINE_RATIO;
}

function matchesExcludedHeading(
	heading: string,
	excludeHeadings: string[],
): boolean {
	const lower = heading.toLowerCase();
	return excludeHeadings.some((ex) => lower.includes(ex.toLowerCase()));
}

/**
 * Preprocess daily note content: filter low-quality paragraphs,
 * remove excluded heading sections, and prepend date context.
 */
export function preprocessDailyNote(
	filtered: string,
	dailyInfo: DailyNoteInfo,
	excludeHeadings: string[],
): string {
	const lines = filtered.split("\n");
	const sections: { heading: string | null; content: string[] }[] = [];
	let current: { heading: string | null; content: string[] } = {
		heading: null,
		content: [],
	};

	for (const line of lines) {
		const match = HEADING_RE.exec(line);
		if (match) {
			if (current.content.length > 0 || current.heading) {
				sections.push(current);
			}
			current = { heading: match[1]?.trim() ?? "", content: [line] };
		} else {
			current.content.push(line);
		}
	}
	if (current.content.length > 0 || current.heading) {
		sections.push(current);
	}

	const surviving: string[] = [];

	for (const section of sections) {
		if (
			section.heading &&
			matchesExcludedHeading(section.heading, excludeHeadings)
		) {
			continue;
		}

		const text = section.content.join("\n");
		const paragraphs = text.split(/\n\n+/);
		const kept = paragraphs.filter((p) => {
			const trimmed = p.trim();
			if (!trimmed) return false;
			return !isLowQualityParagraph(trimmed);
		});

		if (kept.length > 0) {
			const block = section.heading
				? [section.content.find((l) => HEADING_RE.test(l)) ?? "", ...kept].join(
						"\n\n",
					)
				: kept.join("\n\n");
			surviving.push(block);
		}
	}

	const preamble = `[Daily note: ${dailyInfo.displayDate} (${dailyInfo.date}, ${dailyInfo.dayOfWeek})]`;
	const body = surviving.join("\n\n");

	return body ? `${preamble}\n\n${body}` : preamble;
}
