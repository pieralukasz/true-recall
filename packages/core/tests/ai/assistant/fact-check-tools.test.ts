import { describe, expect, it } from "vitest";

import {
	allowsCorrection,
	buildFactCheckTools,
	FACT_CHECK_CORRECTION_GATE_MESSAGE,
	parseFactCheckReport,
	REPORT_FACT_CHECK_TOOL,
} from "../../../src/ai/assistant/fact-check-tools";

describe("buildFactCheckTools", () => {
	it("offers the report tool plus card edits and read-only tools, nothing else", () => {
		const names = buildFactCheckTools().map((tool) => tool.function.name);
		expect(names).toEqual([
			"report_fact_check",
			"update_proposal",
			"remove_proposal",
			"update_card",
			"read_note",
			"get_related_cards",
		]);
	});

	it("declares JSON-schema parameters with the verdict enum", () => {
		expect(REPORT_FACT_CHECK_TOOL.type).toBe("function");
		const params = REPORT_FACT_CHECK_TOOL.function.parameters as {
			properties: { verdict: { enum: string[] } };
			required: string[];
		};
		expect(params.properties.verdict.enum).toEqual([
			"confirmed",
			"incorrect",
			"outdated",
			"unverifiable",
		]);
		expect(params.required).toEqual([
			"verdict",
			"confidence",
			"summary",
			"evidence",
		]);
	});
});

describe("parseFactCheckReport", () => {
	const evidence = [
		{
			url: "https://docs.example/a",
			title: "Docs",
			quote: "The default is 5.",
		},
	];

	it("accepts a complete report and trims quotes to 300 characters", () => {
		const parsed = parseFactCheckReport({
			verdict: "confirmed",
			confidence: "high",
			summary: " Checked the default value. ",
			evidence: [{ ...evidence[0], quote: "x".repeat(400) }],
		});
		expect(parsed).toEqual({
			ok: true,
			result: {
				verdict: "confirmed",
				confidence: "high",
				summary: "Checked the default value.",
				evidence: [
					{
						url: "https://docs.example/a",
						title: "Docs",
						quote: "x".repeat(300),
					},
				],
			},
		});
	});

	it("rejects an unknown verdict and names the allowed values", () => {
		const parsed = parseFactCheckReport({
			verdict: "maybe",
			confidence: "high",
			summary: "s",
			evidence,
		});
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error).toContain('Invalid verdict "maybe"');
			expect(parsed.error).toContain("unverifiable");
		}
	});

	it("rejects an unknown confidence", () => {
		const parsed = parseFactCheckReport({
			verdict: "confirmed",
			confidence: "sure",
			summary: "s",
			evidence,
		});
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.error).toContain("Invalid confidence");
	});

	it("rejects an empty summary", () => {
		const parsed = parseFactCheckReport({
			verdict: "confirmed",
			confidence: "high",
			summary: "   ",
			evidence,
		});
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.error).toContain("non-empty summary");
	});

	it("rejects confirmed, incorrect and outdated without evidence", () => {
		for (const verdict of ["confirmed", "incorrect", "outdated"]) {
			const parsed = parseFactCheckReport({
				verdict,
				confidence: "medium",
				summary: "s",
				evidence: [],
			});
			expect(parsed.ok).toBe(false);
			if (!parsed.ok) expect(parsed.error).toContain("at least one source");
		}
	});

	it("accepts unverifiable without evidence", () => {
		const parsed = parseFactCheckReport({
			verdict: "unverifiable",
			confidence: "low",
			summary: "Opinion, no sources apply.",
			evidence: [],
		});
		expect(parsed).toMatchObject({
			ok: true,
			result: { verdict: "unverifiable", evidence: [] },
		});
	});

	it("drops malformed evidence entries and non-http URLs", () => {
		const parsed = parseFactCheckReport({
			verdict: "confirmed",
			confidence: "high",
			summary: "s",
			evidence: [
				"nope",
				{ url: "ftp://files.example/a" },
				{ url: "  https://ok.example/b  ", title: "  ", quote: "" },
			],
		});
		expect(parsed).toMatchObject({
			ok: true,
			result: { evidence: [{ url: "https://ok.example/b" }] },
		});
	});
});

describe("allowsCorrection", () => {
	it("permits corrections only after incorrect or outdated", () => {
		expect(allowsCorrection("incorrect")).toBe(true);
		expect(allowsCorrection("outdated")).toBe(true);
		expect(allowsCorrection("confirmed")).toBe(false);
		expect(allowsCorrection("unverifiable")).toBe(false);
		expect(allowsCorrection(undefined)).toBe(false);
	});

	it("exposes the gate message the agent returns to the model", () => {
		expect(FACT_CHECK_CORRECTION_GATE_MESSAGE).toContain("report_fact_check");
	});
});
