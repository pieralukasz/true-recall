import { describe, expect, it } from "vitest";

import { BUILTIN_BASIC_PRO_PROMPT } from "../../../src/ai/prompts/builtin-basic-pro.prompt";

describe("BUILTIN_BASIC_PRO_PROMPT", () => {
	it("no longer contains the EXHAUSTIVE padding rule", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).not.toMatch(/EXHAUSTIVE/i);
		expect(BUILTIN_BASIC_PRO_PROMPT).not.toMatch(/Never reduce card count/i);
	});

	it("contains the seven core rules R1..R7", () => {
		for (const rule of ["R1", "R2", "R3", "R4", "R5", "R6", "R7"]) {
			expect(BUILTIN_BASIC_PRO_PROMPT).toContain(rule);
		}
	});

	it("bans meta-question patterns explicitly", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/jedna z/i);
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/inna/i);
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/Wymień wszystkie|List all/i);
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/w punkcie|in point/i);
	});

	it("documents the enumeration CONDITION -> CATEGORY preference", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/CONDITION\s*(→|->)\s*CATEGORY/i);
	});

	it("documents the interference superscript pattern", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/superscript/i);
	});

	it("permits returning an empty array when nothing new is added", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/return\s*\[\]/i);
	});

	it("contains the {{EXISTING_CARDS}} placeholder exactly once", () => {
		const matches = BUILTIN_BASIC_PRO_PROMPT.match(/\{\{EXISTING_CARDS\}\}/g);
		expect(matches).not.toBeNull();
		expect(matches).toHaveLength(1);
	});

	it("keeps the source-quote contract for the editor highlight", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/character-perfect/i);
	});

	it("instructs to match the source language", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/same language/i);
	});

	it("contains six labelled few-shot example pairs", () => {
		const badCount = (BUILTIN_BASIC_PRO_PROMPT.match(/\[BAD\]/g) ?? []).length;
		const goodCount = (BUILTIN_BASIC_PRO_PROMPT.match(/\[GOOD\]/g) ?? [])
			.length;
		const whyCount = (BUILTIN_BASIC_PRO_PROMPT.match(/\[WHY\]/g) ?? []).length;
		expect(badCount).toBeGreaterThanOrEqual(5); // Example 4 is a positive-only baseline
		expect(goodCount).toBe(6);
		expect(whyCount).toBe(6);
	});

	it("includes the heuristics meta-question example", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/heurystyk/i);
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/20% nakładu/);
	});

	it("includes the interference disambiguator example", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/beta-amyloid/);
		expect(BUILTIN_BASIC_PRO_PROMPT).toContain("ᵗᵃᵘ");
	});

	it("includes the hallucination-prevention example", () => {
		expect(BUILTIN_BASIC_PRO_PROMPT).toMatch(/Prawo malejących przychodów/);
	});
});
