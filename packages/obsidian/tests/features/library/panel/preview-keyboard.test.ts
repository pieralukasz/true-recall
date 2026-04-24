import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { resolvePreviewKeyAction } from "@true-recall/obsidian/features/library/ui/panel/preview/preview-keyboard";

describe("resolvePreviewKeyAction", () => {
	it("Escape always closes", () => {
		expect(
			resolvePreviewKeyAction({
				key: "Escape",
				isAnswerRevealed: false,
				isGradable: true,
			}),
		).toEqual({ type: "close" });
		expect(
			resolvePreviewKeyAction({
				key: "Escape",
				isAnswerRevealed: true,
				isGradable: true,
			}),
		).toEqual({ type: "close" });
	});

	it("Space reveals when answer hidden", () => {
		expect(
			resolvePreviewKeyAction({
				key: " ",
				isAnswerRevealed: false,
				isGradable: true,
			}),
		).toEqual({ type: "reveal" });
	});

	it("Space grades Good when answer revealed and gradable", () => {
		expect(
			resolvePreviewKeyAction({
				key: " ",
				isAnswerRevealed: true,
				isGradable: true,
			}),
		).toEqual({ type: "grade", rating: Rating.Good });
	});

	it("1/2/3/4 map to Again/Hard/Good/Easy when revealed", () => {
		const base = { isAnswerRevealed: true, isGradable: true };
		expect(resolvePreviewKeyAction({ key: "1", ...base })).toEqual({
			type: "grade",
			rating: Rating.Again,
		});
		expect(resolvePreviewKeyAction({ key: "2", ...base })).toEqual({
			type: "grade",
			rating: Rating.Hard,
		});
		expect(resolvePreviewKeyAction({ key: "3", ...base })).toEqual({
			type: "grade",
			rating: Rating.Good,
		});
		expect(resolvePreviewKeyAction({ key: "4", ...base })).toEqual({
			type: "grade",
			rating: Rating.Easy,
		});
	});

	it("digits are noop when answer is hidden", () => {
		expect(
			resolvePreviewKeyAction({
				key: "1",
				isAnswerRevealed: false,
				isGradable: true,
			}),
		).toEqual({ type: "noop" });
	});

	it("grading keys are noop when not gradable", () => {
		const base = { isAnswerRevealed: true, isGradable: false };
		expect(resolvePreviewKeyAction({ key: "1", ...base })).toEqual({
			type: "noop",
		});
		expect(resolvePreviewKeyAction({ key: " ", ...base })).toEqual({
			type: "noop",
		});
	});

	it("unrecognized keys are noop", () => {
		expect(
			resolvePreviewKeyAction({
				key: "x",
				isAnswerRevealed: true,
				isGradable: true,
			}),
		).toEqual({ type: "noop" });
	});
});
