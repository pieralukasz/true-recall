import { describe, expect, it } from "vitest";
import {
	buildDraftRegion,
	buildMoveUpdate,
	buildResizeUpdate,
	commitDraftRegion,
	deleteRegion,
	getRegionCorner,
	updateRegion,
} from "../../../src/features/image-occlusion/canvas-interactions";
import type {
	IODefinition,
	IORegion,
} from "../../../src/features/image-occlusion/types";

function makeRegion(overrides: Partial<IORegion> = {}): IORegion {
	return {
		id: "r1",
		x: 0.2,
		y: 0.3,
		w: 0.4,
		h: 0.3,
		groupKey: "0",
		shape: "rect",
		...overrides,
	};
}

function makeDef(regions: IORegion[] = []): IODefinition {
	return { regions, maskMode: "solo", version: 1 };
}

// ─── getRegionCorner ───────────────────────────

describe("getRegionCorner", () => {
	const region = makeRegion({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 });

	it("returns top-left for nw", () => {
		expect(getRegionCorner(region, "nw")).toEqual({ x: 0.1, y: 0.2 });
	});

	it("returns top-right for ne", () => {
		const p = getRegionCorner(region, "ne");
		expect(p.x).toBeCloseTo(0.6);
		expect(p.y).toBeCloseTo(0.2);
	});

	it("returns bottom-left for sw", () => {
		const p = getRegionCorner(region, "sw");
		expect(p.x).toBeCloseTo(0.1);
		expect(p.y).toBeCloseTo(0.5);
	});

	it("returns bottom-right for se", () => {
		const p = getRegionCorner(region, "se");
		expect(p.x).toBeCloseTo(0.6);
		expect(p.y).toBeCloseTo(0.5);
	});
});

// ─── updateRegion ──────────────────────────────

describe("updateRegion", () => {
	it("updates the region matching the id", () => {
		const r1 = makeRegion({ id: "r1", x: 0.1 });
		const r2 = makeRegion({ id: "r2", x: 0.5 });
		const def = makeDef([r1, r2]);

		const result = updateRegion(def, "r1", (r) => ({ ...r, x: 0.9 }));
		expect(result.regions[0].x).toBe(0.9);
		expect(result.regions[1].x).toBe(0.5);
	});

	it("leaves all regions unchanged if id not found", () => {
		const r1 = makeRegion({ id: "r1" });
		const def = makeDef([r1]);

		const result = updateRegion(def, "nonexistent", (r) => ({
			...r,
			x: 0.99,
		}));
		expect(result.regions[0].x).toBe(r1.x);
	});
});

// ─── deleteRegion ──────────────────────────────

describe("deleteRegion", () => {
	it("removes the region with matching id", () => {
		const r1 = makeRegion({ id: "r1" });
		const r2 = makeRegion({ id: "r2" });
		const def = makeDef([r1, r2]);

		const result = deleteRegion(def, "r1");
		expect(result.regions).toHaveLength(1);
		expect(result.regions[0].id).toBe("r2");
	});

	it("returns unchanged definition if id not found", () => {
		const def = makeDef([makeRegion({ id: "r1" })]);
		const result = deleteRegion(def, "nonexistent");
		expect(result.regions).toHaveLength(1);
	});
});

// ─── buildDraftRegion ──────────────────────────

describe("buildDraftRegion", () => {
	it("produces correct rect when dragging down-right", () => {
		const draft = buildDraftRegion(0.1, 0.2, 0.5, 0.6, "rect");
		expect(draft.x).toBeCloseTo(0.1);
		expect(draft.y).toBeCloseTo(0.2);
		expect(draft.w).toBeCloseTo(0.4);
		expect(draft.h).toBeCloseTo(0.4);
		expect(draft.shape).toBe("rect");
		expect(draft.id).toBe("draft");
	});

	it("produces correct rect when dragging up-left", () => {
		const draft = buildDraftRegion(0.5, 0.6, 0.1, 0.2, "ellipse");
		expect(draft.x).toBeCloseTo(0.1);
		expect(draft.y).toBeCloseTo(0.2);
		expect(draft.w).toBeCloseTo(0.4);
		expect(draft.h).toBeCloseTo(0.4);
		expect(draft.shape).toBe("ellipse");
	});

	it("handles zero-size drag (same start and end)", () => {
		const draft = buildDraftRegion(0.5, 0.5, 0.5, 0.5, "rect");
		expect(draft.w).toBe(0);
		expect(draft.h).toBe(0);
	});
});

// ─── buildMoveUpdate ───────────────────────────

describe("buildMoveUpdate", () => {
	it("moves region by offset", () => {
		const region = makeRegion({ x: 0.2, y: 0.3, w: 0.3, h: 0.2 });
		const result = buildMoveUpdate(region, { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.1 });
		expect(result.x).toBeCloseTo(0.4);
		expect(result.y).toBeCloseTo(0.4);
	});

	it("clamps to left/top boundary", () => {
		const region = makeRegion({ x: 0.1, y: 0.1, w: 0.3, h: 0.2 });
		const result = buildMoveUpdate(region, { x: 0.05, y: 0.02 }, { x: 0.1, y: 0.1 });
		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
	});

	it("clamps to right/bottom boundary", () => {
		const region = makeRegion({ x: 0.5, y: 0.5, w: 0.3, h: 0.4 });
		const result = buildMoveUpdate(region, { x: 0.95, y: 0.95 }, { x: 0.1, y: 0.1 });
		expect(result.x).toBeCloseTo(0.7); // 1 - 0.3
		expect(result.y).toBeCloseTo(0.6); // 1 - 0.4
	});
});

// ─── buildResizeUpdate ─────────────────────────

describe("buildResizeUpdate", () => {
	const region = makeRegion({ x: 0.2, y: 0.3, w: 0.4, h: 0.3 });

	it("resizes from nw corner", () => {
		const result = buildResizeUpdate(region, "nw", { x: 0.1, y: 0.2 });
		expect(result.x).toBeCloseTo(0.1);
		expect(result.y).toBeCloseTo(0.2);
		expect(result.w).toBeCloseTo(0.5);
		expect(result.h).toBeCloseTo(0.4);
	});

	it("resizes from se corner", () => {
		const result = buildResizeUpdate(region, "se", { x: 0.8, y: 0.8 });
		expect(result.x).toBeCloseTo(0.2);
		expect(result.y).toBeCloseTo(0.3);
		expect(result.w).toBeCloseTo(0.6);
		expect(result.h).toBeCloseTo(0.5);
	});

	it("enforces minimum size", () => {
		const result = buildResizeUpdate(region, "se", { x: 0.2, y: 0.3 });
		expect(result.w).toBeGreaterThanOrEqual(0.01);
		expect(result.h).toBeGreaterThanOrEqual(0.01);
	});

	it("clamps to canvas bounds", () => {
		const result = buildResizeUpdate(region, "se", { x: 1.5, y: 1.5 });
		expect(result.x + result.w).toBeLessThanOrEqual(1);
		expect(result.y + result.h).toBeLessThanOrEqual(1);
	});

	it("resizes from ne corner", () => {
		const result = buildResizeUpdate(region, "ne", { x: 0.8, y: 0.2 });
		expect(result.x).toBeCloseTo(0.2);
		expect(result.y).toBeCloseTo(0.2);
		expect(result.w).toBeCloseTo(0.6);
		expect(result.h).toBeCloseTo(0.4);
	});

	it("resizes from sw corner", () => {
		const result = buildResizeUpdate(region, "sw", { x: 0.1, y: 0.8 });
		expect(result.x).toBeCloseTo(0.1);
		expect(result.y).toBeCloseTo(0.3);
		expect(result.w).toBeCloseTo(0.5);
		expect(result.h).toBeCloseTo(0.5);
	});
});

// ─── commitDraftRegion ─────────────────────────

describe("commitDraftRegion", () => {
	it("commits a valid draft region", () => {
		const def = makeDef([]);
		const draft = buildDraftRegion(0.1, 0.2, 0.5, 0.6, "rect");

		const result = commitDraftRegion(def, draft);
		expect(result).not.toBeNull();
		expect(result!.definition.regions).toHaveLength(1);
		expect(result!.regionId).toBeTruthy();
		expect(result!.definition.regions[0].id).toBe(result!.regionId);
		expect(result!.definition.regions[0].groupKey).toBe("0");
	});

	it("assigns sequential group keys", () => {
		const existing = makeRegion({ id: "r1", groupKey: "0" });
		const def = makeDef([existing]);
		const draft = buildDraftRegion(0.1, 0.2, 0.5, 0.6, "ellipse");

		const result = commitDraftRegion(def, draft);
		expect(result).not.toBeNull();
		expect(result!.definition.regions).toHaveLength(2);
		expect(result!.definition.regions[1].groupKey).toBe("1");
		expect(result!.definition.regions[1].shape).toBe("ellipse");
	});

	it("rejects undersized drafts", () => {
		const def = makeDef([]);
		const tinyDraft = buildDraftRegion(0.5, 0.5, 0.505, 0.505, "rect");

		const result = commitDraftRegion(def, tinyDraft);
		expect(result).toBeNull();
	});

	it("preserves existing regions", () => {
		const r1 = makeRegion({ id: "r1" });
		const def = makeDef([r1]);
		const draft = buildDraftRegion(0.1, 0.2, 0.5, 0.6, "rect");

		const result = commitDraftRegion(def, draft);
		expect(result).not.toBeNull();
		expect(result!.definition.regions[0].id).toBe("r1");
	});
});
