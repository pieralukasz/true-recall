import { describe, expect, it } from "vitest";

import type { CardAIPreset } from "@true-recall/core";

import {
	resolveCardAIPolicy,
	runLocalCardTransform,
} from "@true-recall/plugins/shared/card-ai";

function preset(patch: Partial<CardAIPreset>): CardAIPreset {
	return {
		id: "legacy",
		name: "Legacy preset",
		prompt: "Do the thing",
		autoApply: false,
		builtin: false,
		...patch,
	};
}

describe("Card Polish policy", () => {
	it.each([
		["Split List", "split", "all"],
		["Reverse", "spawn", "all"],
		["Why", "spawn", "all"],
		["Ambiguity", "edit", "question"],
		["Answer", "edit", "empty-answer"],
	] as const)("migrates the legacy %s preset", (name, mode, fieldScope) => {
		expect(resolveCardAIPolicy(preset({ name }))).toMatchObject({
			mode,
			fieldScope,
			executor: "ai",
		});
	});

	it("lets explicit policy override legacy name inference", () => {
		expect(
			resolveCardAIPolicy(
				preset({
					name: "Split List",
					mode: "edit",
					fieldScope: "answer",
				}),
			),
		).toMatchObject({ mode: "edit", fieldScope: "answer", executor: "ai" });
	});

	it("runs Remove Backlinks locally and preserves surrounding Markdown", () => {
		const legacy = preset({
			name: "Remove Backlinks",
			prompt: "Remove all backlinks from text.",
		});
		const policy = resolveCardAIPolicy(legacy);

		expect(policy.executor).toBe("remove-backlinks");
		expect(
			runLocalCardTransform(policy.executor as "remove-backlinks", {
				Front: "What is **[[Working memory]]** and [[target|its alias]]?",
				Back: "Keep ![[images/chart.png]] embedded.",
			}),
		).toEqual({
			Front: "What is **Working memory** and its alias?",
			Back: "Keep ![[images/chart.png]] embedded.",
		});
	});

	it("shortens local attachment paths without touching web URLs", () => {
		const policy = resolveCardAIPolicy(
			preset({
				name: "Remove Attachments",
				prompt: "Collapse file paths to their basename.",
			}),
		);

		expect(policy.executor).toBe("shorten-attachment-paths");
		expect(
			runLocalCardTransform(policy.executor as "shorten-attachment-paths", {
				Front: "![Diagram](assets/course/diagram.png)",
				Back: "![[attachments/chart.png|300]] https://example.com/a/b.png",
			}),
		).toEqual({
			Front: "![Diagram](diagram.png)",
			Back: "![[chart.png|300]] https://example.com/a/b.png",
		});
	});
});
