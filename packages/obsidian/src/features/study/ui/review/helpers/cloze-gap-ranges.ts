/**
 * Offsets of the `[text]` placeholders in a cloze question.
 *
 * Real links are skipped: `[text](url)`, `[[note]]` and `[[note|alias]]`.
 *
 * Review used to tint the gap with a CSS rule on `cm-link`, but CM6 gives that
 * same class to the text of a real link, so a selector cannot tell them apart
 * and links ended up highlighted as well. Marking the offsets instead keeps the
 * decision in one place, shared by review and the browser preview.
 */
export function placeholderRanges(question: string): [number, number][] {
	const ranges: [number, number][] = [];
	const pattern = /\[[^\]]*\]/g;
	for (const match of question.matchAll(pattern)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (question[end] === "(") continue;
		if (question[start + 1] === "[") continue;
		if (start > 0 && question[start - 1] === "[") continue;
		ranges.push([start, end]);
	}
	return ranges;
}
