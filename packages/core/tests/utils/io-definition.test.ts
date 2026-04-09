import { describe, expect, it } from "vitest";

import {
	getIOGroupOrds,
	normalizeIOImagePath,
	parseIODefinition,
	serializeIODefinition,
} from "../../src/utils/io-definition";

describe("image occlusion definition helpers", () => {
	it("parses legacy region array into v1 definition", () => {
		const raw = JSON.stringify([
			{ id: "r1", x: 10, y: 20, w: 30, h: 40, shape: "rect" },
			{ id: "r2", x: 0.5, y: 0.1, w: 0.2, h: 0.15, shape: "ellipse" },
		]);

		const parsed = parseIODefinition(raw);
		expect(parsed).not.toBeNull();
		expect(parsed!.version).toBe(1);
		expect(parsed!.maskMode).toBe("solo");
		expect(parsed!.regions).toHaveLength(2);
		expect(parsed!.regions[0]!.groupKey).toBe("0");
		expect(parsed!.regions[0]!.x).toBeCloseTo(0.1);
		expect(parsed!.regions[1]!.shape).toBe("ellipse");
	});

	it("parses v1 object and keeps maskMode", () => {
		const raw = JSON.stringify({
			version: 1,
			maskMode: "all",
			regions: [
				{
					id: "r1",
					x: 0.1,
					y: 0.1,
					w: 0.2,
					h: 0.2,
					shape: "rect",
					groupKey: "4",
				},
			],
		});

		const parsed = parseIODefinition(raw);
		expect(parsed).not.toBeNull();
		expect(parsed!.maskMode).toBe("all");
		expect(getIOGroupOrds(parsed!)).toEqual([4]);
	});

	it("falls back to region index when groupKey is invalid", () => {
		const raw = JSON.stringify({
			version: 1,
			maskMode: "solo",
			regions: [
				{
					id: "r1",
					x: 0.1,
					y: 0.1,
					w: 0.2,
					h: 0.2,
					shape: "rect",
					groupKey: "abc",
				},
				{
					id: "r2",
					x: 0.3,
					y: 0.3,
					w: 0.2,
					h: 0.2,
					shape: "rect",
					groupKey: "2",
				},
			],
		});

		const parsed = parseIODefinition(raw);
		expect(parsed).not.toBeNull();
		expect(getIOGroupOrds(parsed!)).toEqual([0, 2]);
	});

	it("serializes and parses definition roundtrip", () => {
		const input = {
			version: 1 as const,
			maskMode: "all" as const,
			regions: [
				{
					id: "r1",
					x: 0.2,
					y: 0.2,
					w: 0.3,
					h: 0.25,
					shape: "ellipse" as const,
					groupKey: "7",
				},
			],
		};

		const serialized = serializeIODefinition(input);
		const parsed = parseIODefinition(serialized);
		expect(parsed).toEqual(input);
	});

	it("normalizes wiki-style image links to vault path", () => {
		expect(normalizeIOImagePath("![[images/atlas.png|320]]")).toBe(
			"images/atlas.png",
		);
		expect(normalizeIOImagePath("![alt](assets/map.jpg)")).toBe(
			"assets/map.jpg",
		);
		expect(normalizeIOImagePath("folder/pic.webp")).toBe("folder/pic.webp");
	});
});
