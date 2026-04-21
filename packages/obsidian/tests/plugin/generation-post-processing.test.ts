import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

const ttsProcessCards = vi.fn();
const imageProcessCards = vi.fn();

vi.mock("@true-recall/obsidian/services/tts-post-processor", () => ({
	TTSPostProcessor: class {
		processCards = ttsProcessCards;
	},
}));

vi.mock("@true-recall/obsidian/services/image-post-processor", () => ({
	ImagePostProcessor: class {
		processCards = imageProcessCards;
	},
}));

vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => ({
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
	settings: {},
	cardStore: {},
} as unknown as import("@true-recall/obsidian/main").default;

beforeEach(() => {
	ttsProcessCards.mockReset();
	imageProcessCards.mockReset();
	ttsProcessCards.mockResolvedValue(undefined);
	imageProcessCards.mockResolvedValue(undefined);
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
		expect(ttsProcessCards).not.toHaveBeenCalled();
		expect(imageProcessCards).not.toHaveBeenCalled();
	});

	it("fires TTS when preset.tts.field is set", () => {
		const preset: GenerationPreset = {
			...textOnlyPreset,
			tts: { field: "Front", voice: "en-US", autoplay: false },
		};
		runPresetPostProcessing(plugin, preset, ["card1"]);
		expect(ttsProcessCards).toHaveBeenCalledWith(["card1"], {
			ttsField: "Front",
			languageCode: "en-US",
		});
	});

	it("does not fire TTS when preset.tts is null", () => {
		runPresetPostProcessing(plugin, textOnlyPreset, ["card1"]);
		expect(ttsProcessCards).not.toHaveBeenCalled();
	});

	it("fires image post-processor when preset.image is set", () => {
		const preset: GenerationPreset = {
			...textOnlyPreset,
			image: {
				targetField: "Image",
				sourceField: "Front",
				style: "cartoon",
			},
		};
		runPresetPostProcessing(plugin, preset, ["card1", "card2"]);
		expect(imageProcessCards).toHaveBeenCalledWith(
			["card1", "card2"],
			[{ fieldName: "Image", sourceField: "Front", style: "cartoon" }],
		);
	});

	it("does not fire image post-processor when preset.image is null", () => {
		runPresetPostProcessing(plugin, textOnlyPreset, ["card1"]);
		expect(imageProcessCards).not.toHaveBeenCalled();
	});
});
