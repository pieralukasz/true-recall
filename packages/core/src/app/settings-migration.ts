import { DEFAULT_SETTINGS } from "../constants";
import type { TrueRecallSettings } from "../types/settings.types";

/**
 * Merge raw persisted data with defaults and run all migrations.
 * Pure function — no side effects.
 */
export function migrateSettings(raw: Partial<TrueRecallSettings> | null): {
	settings: TrueRecallSettings;
	needsSave: boolean;
} {
	const settings: TrueRecallSettings = { ...DEFAULT_SETTINGS, ...raw };
	let needsSave = false;

	// easyDays: array → object migration
	if (Array.isArray(settings.easyDays)) {
		settings.easyDays = {
			recurringDays: settings.easyDays as unknown as number[],
			specificDates: [],
		};
	}

	// Backfill new preset fields for existing presets
	if (settings.fsrsPresets) {
		for (const preset of settings.fsrsPresets) {
			preset.leechThreshold ??= 8;
			preset.leechAction ??= "tag-only";
			preset.newCardOrder ??= settings.newCardOrder;
			preset.reviewOrder ??= settings.reviewOrder;
			preset.newReviewMix ??= settings.newReviewMix;
		}
	}

	// Migrate global FSRS settings → Default preset for existing users
	if (!raw?.fsrsPresets) {
		settings.fsrsPresets = [
			{
				id: "default",
				name: "Default",
				requestRetention: settings.fsrsRequestRetention,
				maximumInterval: settings.fsrsMaximumInterval,
				weights: settings.fsrsWeights,
				learningSteps: settings.learningSteps,
				relearningSteps: settings.relearningSteps,
				newCardsPerDay: settings.newCardsPerDay,
				reviewsPerDay: settings.reviewsPerDay,
				createdAt: Date.now(),
				lastOptimization: settings.lastOptimization,
				lastOptimizationReviewCount: settings.lastOptimizationReviewCount,
				lastOptimizationMetrics: settings.lastOptimizationMetrics,
			},
		];
		settings.defaultPresetId = "default";
		needsSave = true;
	}

	// Inject "vocab" toolbar button for existing users who don't have it yet
	if (
		raw?.editorToolbarButtons &&
		!settings.editorToolbarButtons.some((b) => b.id === "vocab")
	) {
		const idx = settings.editorToolbarButtons.findIndex(
			(b) => b.id === "flashcards",
		);
		settings.editorToolbarButtons.splice(idx + 1, 0, {
			id: "vocab",
			enabled: true,
		});
		needsSave = true;
	}
	if (
		raw?.globalToolbarButtons &&
		!settings.globalToolbarButtons.some((b) => b.id === "vocab")
	) {
		const idx = settings.globalToolbarButtons.findIndex(
			(b) => b.id === "flashcards",
		);
		settings.globalToolbarButtons.splice(idx + 1, 0, {
			id: "vocab",
			enabled: true,
		});
		needsSave = true;
	}

	return { settings, needsSave };
}
