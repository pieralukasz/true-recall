import { describe, expect, it, vi } from "vitest";

import type { PresetService } from "../../../src/services/notes/preset.service";
import {
	R_MODE_CEILING_MAX,
	resolveRModeCeiling,
} from "../../../src/services/review/retrievability-queue";
import { createRModeCardOptionsResolver } from "../../../src/services/review/rmode-card-options";
import type {
	FSRSPreset,
	FSRSSettings,
} from "../../../src/types/settings.types";
import { createMockFlashcard } from "../../mocks/fsrs.mocks";

function createPreset(
	name: string,
	overrides: Partial<FSRSPreset> = {},
): FSRSPreset {
	return {
		id: name.toLowerCase(),
		name,
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		createdAt: Date.now(),
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
		newCardOrder: "random",
		reviewOrder: "due-date",
		newReviewMix: "mix-with-reviews",
		...overrides,
	};
}

describe("resolveRModeCeiling", () => {
	it("clamps the ceiling at the maximum", () => {
		const ceiling = resolveRModeCeiling(0.98, 0.05);

		expect(ceiling).toBe(R_MODE_CEILING_MAX);
		expect(R_MODE_CEILING_MAX).toBe(0.999);
	});

	it("returns retention plus offset below the clamp", () => {
		const ceiling = resolveRModeCeiling(0.9, 0.05);

		expect(ceiling).toBeCloseTo(0.95, 10);
	});
});

describe("createRModeCardOptionsResolver", () => {
	it("derives thresholds and FSRS settings from the resolved preset", () => {
		const preset = createPreset("Strict", { requestRetention: 0.85 });
		const presetSettings = {
			requestRetention: 0.85,
		} as unknown as FSRSSettings;
		const presetService = {
			resolvePresetForCard: vi.fn(() => preset),
			toFSRSSettings: vi.fn(() => presetSettings),
		} as unknown as PresetService;
		const card = createMockFlashcard({ id: "c1", sourceUid: "uid-1" });

		const resolve = createRModeCardOptionsResolver({
			presetService,
			ceilingOffset: 0.05,
		});
		const options = resolve(card);

		expect(options.comfortFloor).toBe(0.85);
		expect(options.ceiling).toBeCloseTo(0.9, 10);
		expect(options.presetSettings).toBe(presetSettings);
		expect(presetService.toFSRSSettings).toHaveBeenCalledWith(preset);
	});

	it("resolves the preset once per sourceUid", () => {
		const preset = createPreset("Default");
		const resolvePresetForCard = vi.fn(() => preset);
		const presetService = {
			resolvePresetForCard,
			toFSRSSettings: vi.fn(() => ({}) as unknown as FSRSSettings),
		} as unknown as PresetService;
		const first = createMockFlashcard({ id: "c1", sourceUid: "shared-uid" });
		const second = createMockFlashcard({ id: "c2", sourceUid: "shared-uid" });

		const resolve = createRModeCardOptionsResolver({
			presetService,
			ceilingOffset: 0.05,
		});
		resolve(first);
		resolve(second);

		expect(resolvePresetForCard).toHaveBeenCalledTimes(1);
	});

	it("resolves the preset per card for different sourceUids", () => {
		const preset = createPreset("Default");
		const resolvePresetForCard = vi.fn(() => preset);
		const presetService = {
			resolvePresetForCard,
			toFSRSSettings: vi.fn(() => ({}) as unknown as FSRSSettings),
		} as unknown as PresetService;
		const first = createMockFlashcard({ id: "c1", sourceUid: "uid-1" });
		const second = createMockFlashcard({ id: "c2", sourceUid: "uid-2" });

		const resolve = createRModeCardOptionsResolver({
			presetService,
			ceilingOffset: 0.05,
		});
		resolve(first);
		resolve(second);

		expect(resolvePresetForCard).toHaveBeenCalledTimes(2);
	});

	it("falls back to the card id when there is no sourceUid", () => {
		const preset = createPreset("Default");
		const resolvePresetForCard = vi.fn(() => preset);
		const presetService = {
			resolvePresetForCard,
			toFSRSSettings: vi.fn(() => ({}) as unknown as FSRSSettings),
		} as unknown as PresetService;
		const first = createMockFlashcard({ id: "no-uid-1" });
		const second = createMockFlashcard({ id: "no-uid-2" });

		const resolve = createRModeCardOptionsResolver({
			presetService,
			ceilingOffset: 0.05,
		});
		resolve(first);
		resolve(first);
		resolve(second);

		expect(resolvePresetForCard).toHaveBeenCalledTimes(2);
	});

	it("forwards the project path to preset resolution", () => {
		const preset = createPreset("Default");
		const resolvePresetForCard = vi.fn(() => preset);
		const presetService = {
			resolvePresetForCard,
			toFSRSSettings: vi.fn(() => ({}) as unknown as FSRSSettings),
		} as unknown as PresetService;
		const card = createMockFlashcard({ id: "c1", sourceUid: "uid-1" });

		const resolve = createRModeCardOptionsResolver({
			presetService,
			ceilingOffset: 0.05,
			projectPath: "Projects/Coding.md",
		});
		resolve(card);

		expect(resolvePresetForCard).toHaveBeenCalledWith(card, {
			projectPath: "Projects/Coding.md",
		});
	});
});
