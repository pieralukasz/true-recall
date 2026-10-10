import { describe, expect, it } from "vitest";

import {
	availableBuiltinCardPolishPresets,
	BUILTIN_CARD_POLISH_PRESETS,
	CARD_POLISH_PROMPT_MARKER,
	findCardPolishPreset,
	listCardPolishPresets,
} from "../../../src/ai/workflows/card-polish-builtins";

const own = {
	id: "mine",
	name: "Mine",
	prompt: "Do it",
	autoApply: false,
	builtin: false,
};

describe("Card Polish built-ins", () => {
	it("gives Pro users the four server presets plus Clean", () => {
		const names = availableBuiltinCardPolishPresets({
			providerType: "pro",
			proKey: "sk-x",
		}).map((p) => p.name);
		expect(names).toEqual([
			"Sharpen",
			"Split List",
			"Reverse",
			"Format",
			"Clean",
		]);
	});

	it("gives everyone else only Clean", () => {
		for (const settings of [
			{ providerType: "openrouter" as const, proKey: "sk-x" },
			{ providerType: "pro" as const, proKey: "" },
		]) {
			expect(
				availableBuiltinCardPolishPresets(settings).map((p) => p.name),
			).toEqual(["Clean"]);
		}
	});

	it("marks every Pro preset for the server and keeps Clean local", () => {
		for (const preset of BUILTIN_CARD_POLISH_PRESETS) {
			expect(preset.builtin).toBe(true);
			if (preset.requiresPro) {
				expect(preset.executor).toBe("ai");
				expect(preset.prompt).toMatch(
					new RegExp(`\\n<<${CARD_POLISH_PROMPT_MARKER}:[a-z-]+>>$`),
				);
			} else {
				expect(preset.executor).toBe("clean");
			}
		}
	});

	it("lists built-ins before the user's presets and finds both", () => {
		const settings = {
			providerType: "pro" as const,
			proKey: "sk-x",
			cardPolish: { userPresets: [own], customPromptAutoApply: false },
		};
		const ids = listCardPolishPresets(settings).map((p) => p.id);
		expect(ids.at(-1)).toBe("mine");
		expect(findCardPolishPreset(settings, "builtin-polish-sharpen")?.name).toBe(
			"Sharpen",
		);
		expect(findCardPolishPreset(settings, "mine")?.name).toBe("Mine");
		expect(
			findCardPolishPreset(
				{ ...settings, providerType: "openrouter" },
				"builtin-polish-sharpen",
			),
		).toBeUndefined();
	});
});
