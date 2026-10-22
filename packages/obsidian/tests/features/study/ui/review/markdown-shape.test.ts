import { describe, expect, it } from "vitest";

import { hasBlockMarkdown } from "@true-recall/obsidian/features/study/ui/review/helpers/markdown-shape";

const WRITING =
	"![InkWriting](<Ink/Writing/answer.svg>) [Edit Writing](https://youtu.be/2arL1jh8ihA?type=inkWriting)";
const DRAWING =
	"![InkDrawing](<Ink/Drawing/tree.svg>) [Edit Drawing](https://youtu.be/2arL1jh8ihA?type=inkDrawing&width=500)";

describe("hasBlockMarkdown", () => {
	it("treats an Ink handwriting embed as block content so its widget gets the full width", () => {
		expect(hasBlockMarkdown(`Handwritten answer:\n\n${WRITING}`)).toBe(true);
	});

	it("keeps a drawing-only or plain answer centered", () => {
		expect(hasBlockMarkdown(`What does this show?\n\n${DRAWING}`)).toBe(false);
		expect(hasBlockMarkdown("One proton, two neutrons")).toBe(false);
	});
});
