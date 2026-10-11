import { describe, expect, it } from "vitest";

import { renderTemplate } from "@true-recall/core/services/cards/template-engine";

import { locateClozeAnswer } from "@true-recall/obsidian/features/study/ui/review/helpers/cloze-answer-ranges";

/** The builtin Cloze answer template: cloze field, then Extra. */
const AFMT = "{{cloze:Text}}<br>{{Extra}}";

function answerFor(text: string, index: number, extra = ""): string {
	return renderTemplate(AFMT, {
		fields: { Text: text, Extra: extra },
		clozeIndex: index,
		frontSide: "",
	});
}

function marked({ text, ranges }: ReturnType<typeof locateClozeAnswer>) {
	let out = "";
	let last = 0;
	for (const [from, to] of ranges) {
		out += `${text.slice(last, from)}[${text.slice(from, to)}]`;
		last = to;
	}
	return out + text.slice(last);
}

describe("locateClozeAnswer", () => {
	it("drops the forced bold and marks the revealed cloze", () => {
		const text =
			"Mine **own bold** then {{c1::the answer}} end. {{c2::other}}.";
		const result = locateClozeAnswer(answerFor(text, 1), text, 1);
		expect(result.text).toBe("Mine **own bold** then the answer end. other.\n");
		expect(marked(result)).toBe(
			"Mine **own bold** then [the answer] end. other.\n",
		);
	});

	it("keeps markdown inside the cloze and the user's highlight", () => {
		const text = "==mark== {{c1::*it* and $x^2$::hint}} tail";
		const result = locateClozeAnswer(answerFor(text, 1), text, 1);
		expect(marked(result)).toBe("==mark== [*it* and $x^2$] tail\n");
	});

	it("marks every occurrence of the same index", () => {
		const text = "{{c1::Paris}} and {{c1::London}}";
		const result = locateClozeAnswer(answerFor(text, 1), text, 1);
		expect(marked(result)).toBe("[Paris] and [London]\n");
	});

	it("marks a nested target inside a revealed outer cloze", () => {
		const text = "{{c1::outer {{c2::inner}} rest}}";
		const result = locateClozeAnswer(answerFor(text, 2), text, 2);
		expect(marked(result)).toBe("outer [inner] rest\n");
	});

	it("keeps the Extra field after the sentence", () => {
		const text = "A {{c1::b}} c";
		const result = locateClozeAnswer(answerFor(text, 1, "**note**"), text, 1);
		expect(marked(result)).toBe("A [b] c\n**note**");
	});

	it("handles <br> line breaks inside the cloze field", () => {
		const text = "line one<br>{{c1::two}}";
		const result = locateClozeAnswer(answerFor(text, 1), text, 1);
		expect(marked(result)).toBe("line one\n[two]\n");
	});

	it("leaves the answer unchanged when the field is not in it verbatim", () => {
		const custom = "<div>A **b** c</div>";
		expect(locateClozeAnswer(custom, "X {{c1::y}}", 1)).toEqual({
			text: custom,
			ranges: [],
		});
	});

	it("leaves the answer unchanged without cloze data or a matching index", () => {
		const answer = answerFor("A {{c1::b}} c", 1);
		expect(locateClozeAnswer(answer, undefined, 1).ranges).toEqual([]);
		expect(
			locateClozeAnswer(answer, "A {{c1::b}} c", undefined).ranges,
		).toEqual([]);
		expect(locateClozeAnswer(answer, "A {{c1::b}} c", 3).ranges).toEqual([]);
	});
});
