import { describe, expect, it } from "vitest";

import { migrateCardPolishSettings } from "../../src/types/settings-migration";

describe("migrateCardPolishSettings", () => {
	it("renames presets → userPresets and drops built-ins", () => {
		const input = {
			cardPolish: {
				presets: [
					{
						id: "builtin-simplify",
						name: "Simplify",
						prompt: "p",
						autoApply: false,
						builtin: true,
					},
					{
						id: "user-1",
						name: "My",
						prompt: "p",
						autoApply: true,
						builtin: false,
					},
				],
				customPromptAutoApply: true,
			},
		} as Record<string, unknown>;
		const out = migrateCardPolishSettings(input) as {
			cardPolish: {
				userPresets: Array<{ id: string }>;
				customPromptAutoApply: boolean;
			};
		};
		expect(out.cardPolish.userPresets).toHaveLength(1);
		expect(out.cardPolish.userPresets[0]?.id).toBe("user-1");
		expect(out.cardPolish.customPromptAutoApply).toBe(true);
	});

	it("is idempotent when already migrated", () => {
		const input = {
			cardPolish: {
				userPresets: [
					{
						id: "u",
						name: "u",
						prompt: "p",
						autoApply: false,
						builtin: false,
					},
				],
				customPromptAutoApply: false,
			},
		} as Record<string, unknown>;
		expect(migrateCardPolishSettings(input)).toEqual(input);
	});

	it("is a no-op when cardPolish is absent", () => {
		const input = { other: 1 } as Record<string, unknown>;
		expect(migrateCardPolishSettings(input)).toEqual(input);
	});

	it("drops the legacy bucket entirely when it held only built-ins", () => {
		const input = {
			cardPolish: {
				presets: [
					{
						id: "builtin-a",
						name: "A",
						prompt: "p",
						autoApply: false,
						builtin: true,
					},
				],
				customPromptAutoApply: false,
			},
		} as Record<string, unknown>;
		const out = migrateCardPolishSettings(input) as {
			cardPolish?: { userPresets: unknown[] };
		};
		expect(out.cardPolish?.userPresets).toEqual([]);
	});
});
