import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import {
	buildGlobalPresetQueueContext,
	buildQueueOptions,
	filterActiveCards,
	isGlobalReviewSession,
} from "@true-recall/core/services/review/session-helpers";
import {
	type CardSchedulingMeta,
	extractFSRSSettings,
	type FSRSPreset,
	type TrueRecallSettings,
} from "@true-recall/core/types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";
import { State } from "ts-fsrs";

export interface ActionableSessionSnapshot {
	queue: CardSchedulingMeta[];
	counts: {
		new: number;
		learning: number;
		due: number;
	};
	queueLength: number;
}

/** Resolves a note name to its file path (replaces MetadataCache dependency) */
export interface INoteResolver {
	resolveNotePath(noteName: string): string | null;
}

export interface ActionableSessionSnapshotDeps {
	allCards: CardSchedulingMeta[];
	archivedSourceUids: ReadonlySet<string>;
	settings: TrueRecallSettings;
	sessionPersistence: SessionPersistenceService;
	presetService: PresetService;
	noteResolver?: INoteResolver;
	hierarchyService?: HierarchyService;
	fsrsService?: FSRSService;
	reviewService?: ReviewService;
}

export interface ActionableSessionSnapshotOptions {
	cache?: Map<string, ActionableSessionSnapshot>;
	activeCards?: CardSchedulingMeta[];
}

function buildScopeCacheKey(filters: SessionFilters): string {
	return JSON.stringify({
		projectPath: filters.projectPath ?? null,
		sourceUidFilter: filters.sourceUidFilter ?? null,
		sourceNoteFilter: filters.sourceNoteFilter ?? null,
		sourceNoteFilters: filters.sourceNoteFilters ?? null,
		filePathFilter: filters.filePathFilter ?? null,
		createdTodayOnly: Boolean(filters.createdTodayOnly),
		createdThisWeek: Boolean(filters.createdThisWeek),
		weakCardsOnly: Boolean(filters.weakCardsOnly),
		stateFilter: filters.stateFilter ?? null,
		ignoreDailyLimits: Boolean(filters.ignoreDailyLimits),
		bypassScheduling: Boolean(filters.bypassScheduling),
		difficultyRange: filters.difficultyRange ?? null,
		lapsesRange: filters.lapsesRange ?? null,
		stabilityRange: filters.stabilityRange ?? null,
		overdueOnly: Boolean(filters.overdueOnly),
		recentlyFailed: Boolean(filters.recentlyFailed),
		cardLimit: filters.cardLimit ?? null,
		studyAheadDays: filters.studyAheadDays ?? null,
		customReviewOrder: filters.customReviewOrder ?? null,
		crammingMode: Boolean(filters.crammingMode),
	});
}

function resolveSessionPresetForFilters(
	filters: SessionFilters,
	presetService: PresetService,
	noteResolver?: INoteResolver,
): FSRSPreset {
	if (filters.projectPath) {
		return presetService.resolvePresetChain(filters.projectPath).effective
			.preset;
	}

	if (filters.sourceNoteFilter && noteResolver) {
		const filePath = noteResolver.resolveNotePath(filters.sourceNoteFilter);
		if (filePath) {
			return presetService.resolvePresetChain(filePath).effective.preset;
		}
	}

	return presetService.getDefaultPreset();
}

function countQueue(
	queue: CardSchedulingMeta[],
): ActionableSessionSnapshot["counts"] {
	let due = 0;
	let newCount = 0;
	let learning = 0;

	for (const card of queue) {
		switch (card.fsrs.state) {
			case State.New:
				newCount++;
				break;
			case State.Review:
				due++;
				break;
			case State.Learning:
			case State.Relearning:
				learning++;
				break;
		}
	}

	return { due, learning, new: newCount };
}

export function computeActionableSessionSnapshot(
	deps: ActionableSessionSnapshotDeps,
	filters: SessionFilters,
	options: ActionableSessionSnapshotOptions = {},
): ActionableSessionSnapshot {
	const cacheKey = buildScopeCacheKey(filters);
	const cached = options.cache?.get(cacheKey);
	if (cached) return cached;

	const activeCards =
		options.activeCards ??
		filterActiveCards(deps.allCards, {
			stateFilter: filters.stateFilter,
			archivedSourceUids: new Set(deps.archivedSourceUids),
		});

	const sessionPreset = resolveSessionPresetForFilters(
		filters,
		deps.presetService,
		deps.noteResolver,
	);
	const queueOptions = buildQueueOptions(
		filters,
		deps.settings,
		deps.sessionPersistence,
		sessionPreset,
	);

	if (filters.sourceUidFilter) {
		queueOptions.sourceUidFilter = new Set([filters.sourceUidFilter]);
	}

	if (isGlobalReviewSession(filters)) {
		const presetContext = buildGlobalPresetQueueContext(
			activeCards,
			deps.presetService,
			deps.sessionPersistence,
		);
		queueOptions.cardPresetById = presetContext.cardPresetById;
		queueOptions.presetDailyLimits = presetContext.presetDailyLimits;
		queueOptions.presetProgressToday = presetContext.presetProgressToday;
		queueOptions.defaultPresetName = presetContext.defaultPresetName;
	}

	if (filters.projectPath && deps.hierarchyService) {
		const projectSourceUids = deps.hierarchyService.getSourceUidsForProject(
			filters.projectPath,
		);
		if (!queueOptions.sourceUidFilter) {
			queueOptions.sourceUidFilter = projectSourceUids;
		} else {
			const intersected = new Set<string>();
			for (const uid of queueOptions.sourceUidFilter) {
				if (projectSourceUids.has(uid)) {
					intersected.add(uid);
				}
			}
			queueOptions.sourceUidFilter = intersected;
		}
	}

	const reviewService = deps.reviewService ?? new ReviewService();
	const fsrsSettings = extractFSRSSettings(deps.settings);
	const fsrsService = deps.fsrsService ?? new FSRSService(fsrsSettings);
	const queue = reviewService.buildQueue(
		activeCards,
		fsrsService,
		queueOptions,
	);

	const snapshot: ActionableSessionSnapshot = {
		queue,
		counts: countQueue(queue),
		queueLength: queue.length,
	};

	options.cache?.set(cacheKey, snapshot);
	return snapshot;
}
