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
 * answer without those markers and marks the returned ranges instead
 * (class `cloze tr-cloze`, tinted in review.styles.css).
 *
 * Returns the answer unchanged with no ranges when the cloze field cannot
 * be found verbatim in it (custom templates that transform the field), so
 * such cards keep the stored bold markers.
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
	if (at < 0) return locateBoldSpan(text, marked);
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

/**
 * Fallback for an answer that no longer matches a fresh render of the template
 * — which is what happens right after the card was edited in review, because
 * the stored answer and the template refresh on different ticks.
 *
 * The revealed cloze is still wrapped in `**…**` somewhere in that answer, so
 * find that span instead of giving up (giving up means the stored bold comes
 * back and the tint disappears).
 */
function locateBoldSpan(
	text: string,
	marked: string,
): ClozeAnswerText {
	const open = marked.indexOf(OPEN);
	const close = marked.lastIndexOf(CLOSE);
	if (open < 0 || close <= open) return { text, ranges: [] };

	const inner = marked.slice(open + 1, close);
	const wrapped = `**${inner}**`;
	const at = text.indexOf(wrapped);
	if (at < 0) return { text, ranges: [] };

	return {
		text: text.slice(0, at) + inner + text.slice(at + wrapped.length),
		ranges: [[at, at + inner.length]],
	};
}

const SPAN_OPEN = '<span class="cloze tr-cloze">';
const SPAN_CLOSE = "</span>";

/**
 * The stored answer as markdown for a read-only preview: the revealed cloze is
 * wrapped in the `cloze tr-cloze` span instead of the stored `**…**`, so the
 * card browser marks it the same way review does. Markdown inside the cloze
 * still renders, because an inline `<span>` does not stop parsing.
 *
 * Returns the answer unchanged when the cloze cannot be located, which leaves
 * the stored bold markers as the fallback.
 */
export function clozeAnswerMarkup(
	answer: string,
	clozeTemplate: string | undefined,
	clozeIndex: number | undefined,
): string {
	const { text, ranges } = locateClozeAnswer(answer, clozeTemplate, clozeIndex);
	if (ranges.length === 0) return answer;
	let out = "";
	let last = 0;
	for (const [from, to] of ranges) {
		// Nested clozes can overlap; keep the outermost one only.
		if (from < last) continue;
		out += `${text.slice(last, from)}${SPAN_OPEN}${text.slice(from, to)}${SPAN_CLOSE}`;
		last = to;
	}
	return out + text.slice(last);
}
