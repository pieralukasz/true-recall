import { describe, expect, it } from "vitest";
import { normalizePointFromRect } from "../../../src/features/image-occlusion/canvas-geometry";

describe("canvas geometry helpers", () => {
	it("maps the same relative point consistently across different image sizes", () => {
		const p1 = normalizePointFromRect(250, 425, {
			left: 50,
			top: 25,
			width: 400,
			height: 800,
		});
		const p2 = normalizePointFromRect(625, 250, {
			left: 125,
			top: 50,
			width: 1000,
			height: 400,
		});

		expect(p1).not.toBeNull();
		expect(p2).not.toBeNull();
		expect(p1?.x).toBeCloseTo(0.5, 6);
		expect(p1?.y).toBeCloseTo(0.5, 6);
		expect(p2?.x).toBeCloseTo(0.5, 6);
		expect(p2?.y).toBeCloseTo(0.5, 6);
	});

	it("clamps points outside the image rect to normalized bounds", () => {
		const point = normalizePointFromRect(-10, 5000, {
			left: 100,
			top: 100,
			width: 300,
			height: 300,
		});

		expect(point).toEqual({ x: 0, y: 1 });
	});
});
