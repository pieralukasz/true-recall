import { describe, expect, it } from "vitest";

import type { AssistantManifest } from "@true-recall/core/ai/assistant";

import { remainingCitations } from "../../src/features/assistant/ui/thread-utils";

describe("remainingCitations", () => {
	it("returns every citation when there is no fact check result", () => {
		const manifest: AssistantManifest = {
			proposals: [],
			citations: [{ url: "https://a.example" }, { url: "https://b.example" }],
		};
		expect(remainingCitations(manifest)).toEqual(manifest.citations);
	});

	it("drops citations already shown as fact check evidence", () => {
		const manifest: AssistantManifest = {
			proposals: [],
			citations: [{ url: "https://a.example" }, { url: "https://b.example" }],
			factCheck: {
				verdict: "confirmed",
				confidence: "high",
				summary: "s",
				evidence: [{ url: "https://a.example", title: "A" }],
			},
		};
		expect(remainingCitations(manifest)).toEqual([
			{ url: "https://b.example" },
		]);
	});
});
