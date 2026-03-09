import { DEFAULT_SETTINGS } from "../src/shared/constants";
import { FSRSService } from "../src/features/core/services/fsrs.service";
import { computeActionableSessionSnapshot } from "../src/features/study/services/actionable-session-snapshot.service";
import { buildGlobalPresetQueueContext } from "../src/features/study/ui/review/helpers/session-helpers";
import type {
	FSRSFlashcardItem,
	FSRSPreset,
	TrueRecallSettings,
} from "../src/shared/types";
import type { PresetService } from "../src/features/core/services/preset.service";
import type { SessionPersistenceService } from "../src/features/core/persistence/session-persistence.service";
import { State } from "ts-fsrs";

function benchmark<T>(label: string, fn: () => T): T {
	const start = performance.now();
	const result = fn();
	const elapsed = (performance.now() - start).toFixed(2);
	console.log(`${label}: ${elapsed}ms`);
	return result;
}

function createPreset(
	name: string,
	overrides: Partial<FSRSPreset> = {},
): FSRSPreset {
	return {
		id: `${name.toLowerCase()}-id`,
		name,
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 40,
		reviewsPerDay: 400,
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

function createCard(index: number): FSRSFlashcardItem {
	const sourceUid = `uid-${index % 3000}`;
	const state =
		index % 11 === 0
			? State.New
			: index % 5 === 0
				? State.Learning
				: State.Review;
	const dueDays = index % 2 === 0 ? -1 : 3;
	const due = new Date(Date.now() + dueDays * 86_400_000).toISOString();
	return {
		id: `card-${index}`,
		question: "Q",
		answer: "A",
		sourceUid,
		sourceNoteName: `Note-${index % 1200}`,
		sourceNotePath: `Notes/Note-${index % 1200}.md`,
		fsrs: {
			id: `card-${index}`,
			due,
			stability: state === State.New ? 0.4 : 8 + (index % 7),
			difficulty: 4 + (index % 5),
			reps: 10 + (index % 6),
			lapses: index % 4,
			state,
			lastReview: new Date(Date.now() - 86_400_000).toISOString(),
			scheduledDays: 7,
			learningStep: 0,
			sourceUid,
		},
	};
}

function run(): void {
	const CARD_COUNT = 18_000;
	const cards = Array.from({ length: CARD_COUNT }, (_, i) => createCard(i));
	const allCards = cards;
	const archived = new Set<string>();

	const defaultPreset = createPreset("Default");
	const intensivePreset = createPreset("Intensive", {
		requestRetention: 0.93,
		learningSteps: [1, 5, 10],
	});
	const relaxedPreset = createPreset("Relaxed", { requestRetention: 0.85 });

	const presetService = {
		getPresets: () => [defaultPreset, intensivePreset, relaxedPreset],
		getDefaultPreset: () => defaultPreset,
		resolvePresetForCard: (card: FSRSFlashcardItem) => {
			const uid = card.sourceUid ?? "";
			if (uid.endsWith("1")) return intensivePreset;
			if (uid.endsWith("2")) return relaxedPreset;
			return defaultPreset;
		},
		resolvePresetChain: () => ({ effective: { preset: defaultPreset } }),
	} as unknown as PresetService;

	const sessionPersistence = {
		getReviewedToday: () => new Set<string>(),
		getNewCardsStudiedToday: () => 0,
		getReviewCardsCompletedToday: () => 0,
		getTodayProgressByPreset: () =>
			new Map([
				["Default", { newStudied: 5, reviewsCompleted: 20 }],
				["Intensive", { newStudied: 2, reviewsCompleted: 8 }],
				["Relaxed", { newStudied: 1, reviewsCompleted: 4 }],
			]),
	} as unknown as SessionPersistenceService;

	const fsrsService = new FSRSService({
		requestRetention: DEFAULT_SETTINGS.fsrsRequestRetention,
		maximumInterval: DEFAULT_SETTINGS.fsrsMaximumInterval,
		weights: DEFAULT_SETTINGS.fsrsWeights,
		learningSteps: DEFAULT_SETTINGS.learningSteps,
		relearningSteps: DEFAULT_SETTINGS.relearningSteps,
		enableShortTerm: true,
	});

	const settings = {
		...DEFAULT_SETTINGS,
		fsrsPresets: [defaultPreset, intensivePreset, relaxedPreset],
		defaultPresetId: defaultPreset.id,
	} as TrueRecallSettings;

	console.log(`Benchmark dataset: ${CARD_COUNT.toLocaleString()} cards`);

	const presetContext = benchmark("buildGlobalPresetQueueContext", () =>
		buildGlobalPresetQueueContext(cards, presetService, sessionPersistence),
	);
	console.log(
		`preset map size: ${presetContext.cardPresetById.size.toLocaleString()}`,
	);

	const snapshot = benchmark("computeActionableSessionSnapshot(global)", () =>
		computeActionableSessionSnapshot(
			{
				allCards,
				archivedSourceUids: archived,
				settings,
				sessionPersistence,
				presetService,
				fsrsService,
			},
			{},
		),
	);
	console.log(`global queue length: ${snapshot.queueLength.toLocaleString()}`);

	const previewSettings = [
		presetService.getDefaultPreset(),
		intensivePreset,
		relaxedPreset,
	].map((preset) => ({
		requestRetention: preset.requestRetention,
		maximumInterval: preset.maximumInterval,
		weights: preset.weights,
		learningSteps: preset.learningSteps,
		relearningSteps: preset.relearningSteps,
		enableShortTerm: true,
	}));

	benchmark("FSRS preview loop (10k cards, mixed presets)", () => {
		for (let i = 0; i < 10_000; i++) {
			const card = cards[i];
			if (!card) continue;
			const settings = previewSettings[i % previewSettings.length];
			if (!settings) continue;
			fsrsService.getSchedulingPreview(card.fsrs, settings);
		}
	});
}

run();
