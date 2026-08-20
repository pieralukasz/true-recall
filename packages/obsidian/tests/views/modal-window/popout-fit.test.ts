import { describe, expect, it } from "vitest";

import {
	type CenterPositionInput,
	computeCenteredPosition,
	computeFitOuterHeight,
	cssToScreenScale,
	type PopoutFitInput,
} from "@true-recall/obsidian/views/modal-window/popout-fit";

// Content measured in a real popout: action bar + toolbar + two fields +
// footer, inside a 38px drag bar and 16px/20px body padding.
const CONTENT_HEIGHT = 315;
const NATURAL_HEIGHT = 38 + CONTENT_HEIGHT + 36;

function input(overrides: Partial<PopoutFitInput> = {}): PopoutFitInput {
	return {
		dragBarHeight: 38,
		contentHeight: CONTENT_HEIGHT,
		bodyPadding: 36,
		viewportHeight: 426,
		viewContentHeight: 426,
		outerWidth: 720,
		innerWidth: 720,
		minOuterHeight: 280,
		maxOuterHeight: 950,
		...overrides,
	};
}

describe("cssToScreenScale", () => {
	it("is 1 at the default zoom level", () => {
		expect(cssToScreenScale(720, 720)).toBe(1);
	});

	it("is below 1 when the window is zoomed out", () => {
		expect(cssToScreenScale(720, 789)).toBeCloseTo(0.9125, 4);
	});

	it("is above 1 when the window is zoomed in", () => {
		expect(cssToScreenScale(720, 655)).toBeCloseTo(1.0992, 4);
	});

	it.each([
		["zero width", 720, 0],
		["negative width", 720, -10],
		["NaN width", 720, Number.NaN],
		["absurd ratio", 720, 1],
	])("falls back to 1 for %s", (_label, outerWidth, innerWidth) => {
		expect(cssToScreenScale(outerWidth, innerWidth)).toBe(1);
	});
});

describe("computeFitOuterHeight", () => {
	it("fits the content exactly at the default zoom level", () => {
		expect(computeFitOuterHeight(input())).toBe(NATURAL_HEIGHT);
	});

	it("converts CSS pixels to screen pixels when the window is zoomed out", () => {
		// Regression: the height used to be computed in CSS px and handed to
		// resizeTo() (screen px) unconverted, leaving the window ~10% too tall.
		expect(
			computeFitOuterHeight(input({ outerWidth: 720, innerWidth: 789 })),
		).toBe(Math.round(NATURAL_HEIGHT * (720 / 789)));
	});

	it("converts CSS pixels to screen pixels when the window is zoomed in", () => {
		expect(
			computeFitOuterHeight(input({ outerWidth: 720, innerWidth: 655 })),
		).toBe(Math.round(NATURAL_HEIGHT * (720 / 655)));
	});

	it("adds the height Obsidian's tab header takes above the view", () => {
		expect(
			computeFitOuterHeight(
				input({ viewportHeight: 426, viewContentHeight: 386 }),
			),
		).toBe(NATURAL_HEIGHT + 40);
	});

	it("ignores an unmeasured view (height 0) instead of counting the whole viewport as chrome", () => {
		expect(
			computeFitOuterHeight(
				input({ viewportHeight: 426, viewContentHeight: 0 }),
			),
		).toBe(NATURAL_HEIGHT);
	});

	it("clamps to the minimum window height", () => {
		expect(computeFitOuterHeight(input({ contentHeight: 20 }))).toBe(280);
	});

	it("clamps to the available screen height", () => {
		expect(computeFitOuterHeight(input({ contentHeight: 4000 }))).toBe(950);
	});

	it("returns null when the content cannot be measured", () => {
		expect(computeFitOuterHeight(input({ contentHeight: Number.NaN }))).toBe(
			null,
		);
	});
});

describe("computeCenteredPosition", () => {
	// A 1512x950 usable area sitting under a 32px menu bar.
	function screenInput(
		overrides: Partial<CenterPositionInput> = {},
	): CenterPositionInput {
		return {
			outerWidth: 720,
			outerHeight: 355,
			availLeft: 0,
			availTop: 32,
			availWidth: 1512,
			availHeight: 950,
			...overrides,
		};
	}

	it("centers the window in the usable area", () => {
		expect(computeCenteredPosition(screenInput())).toEqual({
			left: 396,
			top: 330,
		});
	});

	it("centers on the size it is given, not on a larger one", () => {
		// Regression: centering read `outerHeight` right after resizeTo(), which
		// could still report the pre-resize height and place the window ~120px
		// too high.
		expect(computeCenteredPosition(screenInput({ outerHeight: 600 })).top).toBe(
			207,
		);
	});

	it("offsets by the screen origin on a secondary display", () => {
		expect(
			computeCenteredPosition(screenInput({ availLeft: 1512, availTop: 0 })),
		).toEqual({ left: 1908, top: 298 });
	});

	it("never positions a window larger than the screen off-origin", () => {
		expect(
			computeCenteredPosition(
				screenInput({ outerWidth: 2000, outerHeight: 1200 }),
			),
		).toEqual({ left: 0, top: 32 });
	});
});
