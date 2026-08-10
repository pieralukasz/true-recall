import { describe, expect, it } from "vitest";

import { resolveGateAction } from "@true-recall/obsidian/preact/useGatedComputed";

describe("resolveGateAction", () => {
	it("keeps the cached value when deps are unchanged", () => {
		expect(
			resolveGateAction({
				becameVisible: false,
				depsChanged: false,
				msSinceLastCompute: 5000,
				throttleMs: 2000,
			}),
		).toEqual({ kind: "keep" });
	});

	it("keeps the cached value on reveal when deps are unchanged", () => {
		expect(
			resolveGateAction({
				becameVisible: true,
				depsChanged: false,
				msSinceLastCompute: 100,
				throttleMs: 2000,
			}),
		).toEqual({ kind: "keep" });
	});

	it("recomputes changed deps once the throttle window has passed", () => {
		expect(
			resolveGateAction({
				becameVisible: false,
				depsChanged: true,
				msSinceLastCompute: 2000,
				throttleMs: 2000,
			}),
		).toEqual({ kind: "recompute" });
	});

	it("schedules a trailing refresh for changed deps within the throttle window", () => {
		expect(
			resolveGateAction({
				becameVisible: false,
				depsChanged: true,
				msSinceLastCompute: 1500,
				throttleMs: 2000,
			}),
		).toEqual({ kind: "trailing", delayMs: 500 });
	});

	it("recomputes a reveal with changed deps before the next render", () => {
		expect(
			resolveGateAction({
				becameVisible: true,
				depsChanged: true,
				msSinceLastCompute: 5000,
				throttleMs: 2000,
			}),
		).toEqual({ kind: "recompute" });
	});

	it("recomputes immediately when throttling is disabled", () => {
		expect(
			resolveGateAction({
				becameVisible: false,
				depsChanged: true,
				msSinceLastCompute: 0,
				throttleMs: 0,
			}),
		).toEqual({ kind: "recompute" });
	});
});
