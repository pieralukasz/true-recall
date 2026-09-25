import { describe, expect, it } from "vitest";

import {
	DEFAULT_FSRS_PRESET,
	DEFAULT_FSRS_WEIGHTS,
	DEFAULT_SETTINGS,
} from "@true-recall/core/constants";
import type { FSRSPreset, TrueRecallSettings } from "@true-recall/core/types";

import { resolveSimulatorBaseline } from "../../../src/features/metrics/store/simulator.slice";
import { createAppStore } from "../../../src/store";
import { createMockDeps } from "../../store/test-helpers";

const PRESET_WEIGHTS = DEFAULT_FSRS_WEIGHTS.map((w) => w + 0.5);
const LEGACY_WEIGHTS = DEFAULT_FSRS_WEIGHTS.map((w) => w + 9);

function makeSettings(
	overrides: Partial<TrueRecallSettings> = {},
): TrueRecallSettings {
	const other: FSRSPreset = {
		...DEFAULT_FSRS_PRESET,
		id: "other",
		name: "Other",
		weights: [...PRESET_WEIGHTS],
		requestRetention: 0.85,
	};
	return {
		...DEFAULT_SETTINGS,
		fsrsWeights: [...LEGACY_WEIGHTS],
		fsrsRequestRetention: 0.7,
		fsrsPresets: [{ ...DEFAULT_FSRS_PRESET }, other],
		defaultPresetId: "other",
		...overrides,
	};
}

describe("resolveSimulatorBaseline", () => {
	it("uses the default preset's weights and retention, not the legacy mirror", () => {
		const baseline = resolveSimulatorBaseline(makeSettings());

		expect(baseline.parameters).toEqual(PRESET_WEIGHTS);
		expect(baseline.desiredRetention).toBe(0.85);
	});

	it("falls back to FSRS defaults when the default preset has no weights", () => {
		const settings = makeSettings({ defaultPresetId: DEFAULT_FSRS_PRESET.id });
		const baseline = resolveSimulatorBaseline(settings);

		expect(baseline.parameters).toEqual([...DEFAULT_FSRS_WEIGHTS]);
		expect(baseline.desiredRetention).toBe(
			DEFAULT_FSRS_PRESET.requestRetention,
		);
	});

	it("uses the legacy fields only for pre-preset settings", () => {
		const baseline = resolveSimulatorBaseline(
			makeSettings({ fsrsPresets: [] }),
		);

		expect(baseline.parameters).toEqual(LEGACY_WEIGHTS);
		expect(baseline.desiredRetention).toBe(0.7);
	});

	it("returns a copy so editing the simulator cannot mutate the preset", () => {
		const settings = makeSettings();
		resolveSimulatorBaseline(settings).parameters[0] = 123;

		expect(settings.fsrsPresets[1]?.weights?.[0]).toBe(PRESET_WEIGHTS[0]);
	});
});

describe("simulator slice", () => {
	it("starts from and resets to the default preset", () => {
		let settings = makeSettings();
		const store = createAppStore({
			...createMockDeps(),
			getSettings: () => settings,
		});
		const sim = () => store.getState().simulator;

		expect(sim().getParameters()).toEqual(PRESET_WEIGHTS);
		expect(sim().getDesiredRetention()).toBe(0.85);

		sim().setParameter(0, 42);
		sim().setDesiredRetention(0.5);
		settings = makeSettings({ defaultPresetId: DEFAULT_FSRS_PRESET.id });
		sim().resetParameters();

		expect(sim().getParameters()).toEqual([...DEFAULT_FSRS_WEIGHTS]);
		expect(sim().getDesiredRetention()).toBe(
			DEFAULT_FSRS_PRESET.requestRetention,
		);
	});
});
