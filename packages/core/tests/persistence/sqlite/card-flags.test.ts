/**
 * Card flag tests (Anki-compatible flags 0-7)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeCardFlag } from "../../../src/types";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

describe("Card flags", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	it("defaults to 0 (no flag) for new cards", () => {
		ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
		expect(ctx.cards.get("card-1")?.flag ?? 0).toBe(0);
	});

	it("persists a flag passed on write", () => {
		ctx.cards.set("card-1", createTestCard({ id: "card-1", flag: 3 }));
		expect(ctx.cards.get("card-1")?.flag).toBe(3);
	});

	it("setCardFlag sets and clears a single card flag", () => {
		ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
		ctx.cards.setCardFlag("card-1", 1);
		expect(ctx.cards.get("card-1")?.flag).toBe(1);
		ctx.cards.setCardFlag("card-1", 0);
		expect(ctx.cards.get("card-1")?.flag).toBe(0);
	});

	it("bulkSetFlag flags only the selected cards", () => {
		for (const id of ["card-1", "card-2", "card-3"]) {
			ctx.cards.set(id, createTestCard({ id }));
		}
		const affected = ctx.cards.bulkSetFlag(["card-1", "card-2"], 7);
		expect(affected).toBe(2);
		expect(ctx.cards.get("card-1")?.flag).toBe(7);
		expect(ctx.cards.get("card-2")?.flag).toBe(7);
		expect(ctx.cards.get("card-3")?.flag ?? 0).toBe(0);
	});

	it("bulkSetFlag returns 0 for empty input", () => {
		expect(ctx.cards.bulkSetFlag([], 2)).toBe(0);
	});
});

describe("normalizeCardFlag", () => {
	it("keeps valid values and clamps invalid ones to 0", () => {
		expect(normalizeCardFlag(5)).toBe(5);
		expect(normalizeCardFlag(0)).toBe(0);
		expect(normalizeCardFlag(8)).toBe(0);
		expect(normalizeCardFlag(-1)).toBe(0);
		expect(normalizeCardFlag(undefined)).toBe(0);
		expect(normalizeCardFlag(Number.NaN)).toBe(0);
	});
});
