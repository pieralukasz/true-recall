import { findClozes } from "@true-recall/core/flashcard/parsing/cloze-parser.service";

/**
 * Offsets of the cloze gaps (`[...]` or `[hint]`) in a cloze question.
 *
 * Only placeholders this card's cloze produces are marked, so other brackets
 * in the text (`a[0]`, `[ ]`, footnotes) keep their normal look. Without the
 * template only the default `[...]` marker counts. Real links are skipped:
 * `[text](url)`, `[[note]]` and `[[note|alias]]`.
 *
 * Review used to tint the gap with a CSS rule on `cm-link`, but CM6 gives that
 * same class to the text of a real link, so a selector cannot tell them apart.
 * Marking the offsets instead keeps the decision in one place, shared by
 * review and the browser preview.
 */
export function placeholderRanges(
	question: string,
	clozeTemplate?: string,
	clozeIndex?: number,
): [number, number][] {
	const gaps =
		clozeTemplate && clozeIndex !== undefined
			? gapTexts(clozeTemplate, clozeIndex)
			: new Set(["[...]"]);
	const ranges: [number, number][] = [];
	const pattern = /\[[^\]]*\]/g;
	for (const match of question.matchAll(pattern)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (!gaps.has(match[0])) continue;
		if (question[end] === "(") continue;
		if (question[start + 1] === "[") continue;
		if (start > 0 && question[start - 1] === "[") continue;
		ranges.push([start, end]);
	}
	return ranges;
}

/** The placeholder texts `renderClozeQuestion` writes for `clozeIndex`. */
function gapTexts(template: string, clozeIndex: number): Set<string> {
	const gaps = new Set<string>();
	const walk = (text: string) => {
		for (const match of findClozes(text)) {
			if (match.index === clozeIndex) {
				gaps.add(match.hint ? `[${match.hint}]` : "[...]");
			} else {
				walk(match.content);
			}
		}
	};
	walk(template);
	return gaps;
}
