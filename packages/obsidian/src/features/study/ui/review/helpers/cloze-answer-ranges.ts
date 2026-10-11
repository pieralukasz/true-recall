import { renderClozeAnswer } from "@true-recall/core/flashcard/parsing/cloze-parser.service";
import { stripBrTags } from "@true-recall/core/utils";

const OPEN = "\uE000";
const CLOSE = "\uE001";

export interface ClozeAnswerText {
	/** Answer text without the bold markers around the revealed cloze. */
	text: string;
	/** [from, to) offsets of each revealed cloze in `text`, sorted by `from`. */
	ranges: [number, number][];
}

/**
 * The stored cloze answer wraps the revealed cloze in `**…**`, which looks
 * the same as bold the user wrote and cannot be restyled. Review shows the
 * answer without those markers and styles the returned ranges instead
 * (class `cloze tr-cloze`, bold by default).
 *
 * Returns the answer unchanged with no ranges when the cloze field cannot
 * be found verbatim in it (custom templates that transform the field), so
 * such cards keep the old bold look.
 */
export function locateClozeAnswer(
	answer: string,
	clozeTemplate: string | undefined,
	clozeIndex: number | undefined,
): ClozeAnswerText {
	const text = stripBrTags(answer);
	if (
		!clozeTemplate ||
		clozeIndex === undefined ||
		clozeTemplate.includes(OPEN) ||
		clozeTemplate.includes(CLOSE)
	) {
		return { text, ranges: [] };
	}
	const template = stripBrTags(clozeTemplate);
	const marked = renderClozeAnswer(
		template,
		clozeIndex,
		(inner) => `${OPEN}${inner}${CLOSE}`,
	);
	if (!marked.includes(OPEN)) return { text, ranges: [] };
	const bold = renderClozeAnswer(template, clozeIndex);
	const at = text.indexOf(bold);
	if (at < 0) return { text, ranges: [] };
	let plain = text.slice(0, at);
	const ranges: [number, number][] = [];
	const open: number[] = [];
	for (const ch of marked) {
		if (ch === OPEN) {
			open.push(plain.length);
		} else if (ch === CLOSE) {
			const from = open.pop();
			if (from !== undefined) ranges.push([from, plain.length]);
		} else {
			plain += ch;
		}
	}
	plain += text.slice(at + bold.length);
	ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
	return { text: plain, ranges };
}
