import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

const notifyInfo = vi.fn();

vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => ({
		info: notifyInfo,
		warning: vi.fn(),
	}),
}));

import {
	isPresetProRequired,
	runPresetPostProcessing,
} from "@true-recall/obsidian/plugin/generation-post-processing";

const textOnlyPreset: GenerationPreset = {
	id: "p",
	name: "P",
	prompt: "Generate cards.",
	noteTypeId: "nt",
	tts: null,
	image: null,
	requiresPro: false,
	builtin: false,
	isDefault: false,
	createdAt: 0,
	updatedAt: 0,
};

const plugin = {
	app: {},
	settings: { proKey: "test-pro-key" },
	cardStore: {},
} as unknown as import("@true-recall/obsidian/main").default;

beforeEach(() => {
	notifyInfo.mockReset();
});

describe("isPresetProRequired", () => {
	it("returns true when tts is set", () => {
		const preset: GenerationPreset = {
			...textOnlyPreset,
			tts: { field: "Front", voice: "en-US", autoplay: false },
		};
		expect(isPresetProRequired(preset)).toBe(true);
	});

	it("returns true when image is set", () => {
		const preset: GenerationPreset = {
			...textOnlyPreset,
			image: { targetField: "Image", sourceField: "Front" },
		};
		expect(isPresetProRequired(preset)).toBe(true);
	});

	it("returns true when preset.requiresPro is set", () => {
		expect(isPresetProRequired({ ...textOnlyPreset, requiresPro: true })).toBe(
			true,
		);
	});

	it("returns false for text-only preset with no tts/image and not requiresPro", () => {
		expect(isPresetProRequired(textOnlyPreset)).toBe(false);
	});
});

describe("runPresetPostProcessing", () => {
	it("is a no-op when createdCardIds is empty", () => {
		runPresetPostProcessing(plugin, textOnlyPreset, []);
		expect(notifyInfo).not.toHaveBeenCalled();
	});

	it("shows 'coming soon' notice when preset.tts is set", () => {
		const preset: GenerationPreset = {
			...textOnlyPreset,
			tts: { field: "Front", voice: "en-US", autoplay: false },
		};
		runPresetPostProcessing(plugin, preset, ["card1"]);
		expect(notifyInfo).toHaveBeenCalledWith(
			"Audio and image generation — coming soon.",
		);
	});

	it("shows 'coming soon' notice when preset.image is set", () => {
		const preset: GenerationPreset = {
			...textOnlyPreset,
			image: { targetField: "Image", sourceField: "Front" },
		};
		runPresetPostProcessing(plugin, preset, ["card1"]);
		expect(notifyInfo).toHaveBeenCalledWith(
			"Audio and image generation — coming soon.",
		);
	});

	it("does not show any notice for a text-only preset", () => {
		runPresetPostProcessing(plugin, textOnlyPreset, ["card1"]);
		expect(notifyInfo).not.toHaveBeenCalled();
	});
});
