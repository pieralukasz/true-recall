import { describe, expect, it } from "vitest";

import type { IORegion } from "@true-recall/plugins/image-occlusion/types";
import {
	buildRenderableRegions,
	getRegionOrdinal,
	getRegionVisualState,
} from "@true-recall/plugins/image-occlusion/utils/card-rendering";

function makeRegion(groupKey: string): IORegion {
	return {
		id: `region-${groupKey}`,
		x: 0.1,
		y: 0.2,
		w: 0.3,
		h: 0.4,
		groupKey,
		shape: "rect",
	};
}

describe("getRegionOrdinal", () => {
	it.each([
		["valid group key", "3", 8, 3],
		["invalid group key", "label", 8, 8],
		["negative group key", "-2", 8, 8],
	])("uses the expected ordinal for a %s", (_name, groupKey, fallback, expected) => {
		expect(getRegionOrdinal(makeRegion(groupKey), fallback)).toBe(expected);
	});
});

describe("buildRenderableRegions", () => {
	it("uses each array index as the fallback ordinal", () => {
		const result = buildRenderableRegions([
			makeRegion("invalid"),
			makeRegion("4"),
		]);

		expect(result.map((item) => item.ordinal)).toEqual([0, 4]);
	});
});

describe("getRegionVisualState", () => {
	it.each([
		["active question region", 1, 1, false, "solo", false, "is-mask-active"],
		[
			"passive question region in solo mode",
			0,
			1,
			false,
			"solo",
			false,
			"is-outline-passive",
		],
		[
			"passive question region in all mode",
			0,
			1,
			false,
			"all",
			false,
			"is-mask-passive",
		],
		["active answer region", 1, 1, true, "all", true, "is-revealed-active"],
		[
			"passive answer region when revealing only one",
			0,
			1,
			true,
			"all",
			true,
			"is-mask-passive",
		],
		[
			"passive answer region in a full preview",
			0,
			1,
			true,
			"all",
			false,
			"is-revealed-passive",
		],
	] as const)("returns the correct state for the %s", (_name, ordinal, active, revealed, mode, singleOnly, expected) => {
		expect(
			getRegionVisualState(ordinal, active, revealed, mode, singleOnly),
		).toBe(expected);
	});
});
