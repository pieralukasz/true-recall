import { describe, expect, it } from "vitest";

import type { CardAIPreset } from "@true-recall/core";

import { mergePresetsForUser } from "@true-recall/plugins/shared/CardAIPluginBase";

const preset = (over: Partial<CardAIPreset>): CardAIPreset => ({
	id: "p",
	name: "p",
	prompt: "",
	autoApply: false,
	builtin: false,
	...over,
});

describe("mergePresetsForUser", () => {
	it("hides Pro-gated built-ins when isPro is false", () => {
		const result = mergePresetsForUser({
			builtins: [preset({ id: "pro-1", builtin: true, requiresPro: true })],
			userPresets: [],
			isPro: false,
		});
		expect(result).toEqual([]);
	});

	it("shows Pro-gated built-ins when isPro is true", () => {
		const builtin = preset({ id: "pro-1", builtin: true, requiresPro: true });
		const result = mergePresetsForUser({
			builtins: [builtin],
			userPresets: [],
			isPro: true,
		});
		expect(result).toEqual([builtin]);
	});

	it("always shows non-Pro built-ins regardless of isPro", () => {
		const builtin = preset({ id: "free-1", builtin: true });
		expect(
			mergePresetsForUser({
				builtins: [builtin],
				userPresets: [],
				isPro: false,
			}),
		).toEqual([builtin]);
		expect(
			mergePresetsForUser({
				builtins: [builtin],
				userPresets: [],
				isPro: true,
			}),
		).toEqual([builtin]);
	});

	it("never filters user presets based on isPro", () => {
		const user = preset({ id: "user-1", builtin: false });
		expect(
			mergePresetsForUser({
				builtins: [],
				userPresets: [user],
				isPro: false,
			}),
		).toEqual([user]);
	});

	it("places built-ins before user presets in the merged list", () => {
		const builtin = preset({ id: "b1", builtin: true });
		const user = preset({ id: "u1", builtin: false });
		expect(
			mergePresetsForUser({
				builtins: [builtin],
				userPresets: [user],
				isPro: false,
			}).map((p) => p.id),
		).toEqual(["b1", "u1"]);
	});

	it("treats requiresPro: undefined as not-Pro-gated", () => {
		const builtin = preset({ id: "b1", builtin: true, requiresPro: undefined });
		expect(
			mergePresetsForUser({
				builtins: [builtin],
				userPresets: [],
				isPro: false,
			}),
		).toEqual([builtin]);
	});
});
