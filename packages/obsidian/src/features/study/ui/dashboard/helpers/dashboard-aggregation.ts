import type { MetadataCache } from "obsidian";

import { aggregateDashboardData } from "@true-recall/core/helpers/note-aggregation";
import { computePriority } from "@true-recall/core/helpers/note-priority";
import { estimateStudyMinutes } from "@true-recall/core/helpers/time-estimate";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import {
	resolveRModeCeiling,
	scoreRModeCard,
} from "@true-recall/core/services/review/retrievability-queue";
import { createRModeCardOptionsResolver } from "@true-recall/core/services/review/rmode-card-options";
import type {
	CardSchedulingMeta,
	TrueRecallSettings,
} from "@true-recall/core/types";
import type {
	DashboardAggregation,
	DashboardNoteEntry,
} from "@true-recall/core/types/dashboard.types";
import type { TodaySummary } from "@true-recall/core/types/fsrs/stats.types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";

import {
	createDashboardSnapshotContext,
	type DashboardSnapshotContext,
} from "./snapshot-context";

export { createDashboardSnapshotContext, type DashboardSnapshotContext };

export interface DashboardAggregationServices {
	settings: TrueRecallSettings;
	sessionPersistence: SessionPersistenceService;
	presetService: PresetService;
	hierarchyService: HierarchyService;
	fsrsService: FSRSService;
	metadataCache: MetadataCache;
}

export interface DashboardAggregationDeps {
	allCards: CardSchedulingMeta[];
	/** Cards that can enter a session: not suspended, buried or archived. */
	activeCards: CardSchedulingMeta[];
	archivedSourceUids: ReadonlySet<string>;
	showArchived: boolean;
	now: Date;
	streakCurrent: number;
	todaySummary: TodaySummary;
	snapshotContext: DashboardSnapshotContext;
	services: DashboardAggregationServices;
}

type SchedulingMode = NonNullable<SessionFilters["schedulingMode"]>;

/**
 * Note rows and the global header of the dashboard.
 *
 * Raw per-note tallies come from the card list; the numbers shown are then
 * replaced by what a session started from that row would actually contain.
 * Note rows honour "Ignore daily limits for note study", so with that setting
 * on a note can show more new cards than its deck.
 */
export function buildDashboardAggregation(
	deps: DashboardAggregationDeps,
): DashboardAggregation {
	const { services, snapshotContext, now } = deps;
	const { settings } = services;
	const schedulingMode: SchedulingMode = settings.rMode.enabled
		? "retrievability"
		: "due";

	const raw = aggregateDashboardData({
		allCards: deps.allCards,
		streakCurrent: deps.streakCurrent,
		todaySummary: deps.todaySummary,
		newCardsCap: settings.newCardsPerDay,
		reviewsCap: settings.reviewsPerDay,
		archivedSourceUids: deps.showArchived ? undefined : deps.archivedSourceUids,
		retrievability: settings.rMode.enabled
			? buildRetrievabilityDeps(services, now)
			: undefined,
		now,
	});

	const snapshotDeps = {
		allCards: deps.allCards,
		archivedSourceUids: deps.archivedSourceUids,
		settings,
		sessionPersistence: services.sessionPersistence,
		presetService: services.presetService,
		metadataCache: services.metadataCache,
		hierarchyService: services.hierarchyService,
		fsrsService: services.fsrsService,
	};
	const snapshotFor = (
		filters: SessionFilters,
		activeCards: CardSchedulingMeta[],
	) =>
		computeActionableSessionSnapshot(snapshotDeps, filters, {
			cache: snapshotContext.cache,
			activeCards,
			sessionProgress: snapshotContext.sessionProgress,
			now,
		});

	const globalSnapshot = snapshotFor({ schedulingMode }, deps.activeCards);
	const cardsByNoteName = groupByNoteName(deps.activeCards);

	const notes = raw.notes.map((note) => {
		const isArchived = note.path
			? services.hierarchyService.isNoteArchived(note.path)
			: false;
		if (isArchived) return note;

		const snapshot = snapshotFor(
			{
				sourceNoteFilter: note.name,
				ignoreDailyLimits: settings.ignoreDailyLimitsForNoteStudy,
				schedulingMode,
			},
			cardsByNoteName.get(note.name) ?? [],
		);
		return applyCounts(note, snapshot.counts);
	});

	const { counts } = globalSnapshot;
	return {
		...raw,
		notes,
		totalDue: counts.due,
		totalNew: counts.new,
		totalLearning: counts.learning,
		totalLearningPending: counts.learningPending,
		estimatedTotalMinutes: estimateStudyMinutes(
			counts.due,
			counts.new,
			counts.learning,
		),
	};
}

function applyCounts(
	note: DashboardNoteEntry,
	counts: {
		due: number;
		new: number;
		learning: number;
		learningPending: number;
	},
): DashboardNoteEntry {
	const updated: DashboardNoteEntry = {
		...note,
		due: counts.due,
		newCount: counts.new,
		learning: counts.learning,
		learningPending: counts.learningPending,
		estimatedMinutes: estimateStudyMinutes(
			counts.due,
			counts.new,
			counts.learning,
		),
	};
	return { ...updated, priority: computePriority(updated) };
}

function buildRetrievabilityDeps(
	services: DashboardAggregationServices,
	now: Date,
) {
	const { rMode, fsrsRequestRetention } = services.settings;
	const scoreOptions = {
		ceiling: resolveRModeCeiling(fsrsRequestRetention, rMode.ceilingOffset),
		comfortFloor: fsrsRequestRetention,
		resolveCardOptions: createRModeCardOptionsResolver({
			presetService: services.presetService,
			ceilingOffset: rMode.ceilingOffset,
		}),
	};
	return {
		getScore: (card: CardSchedulingMeta) =>
			scoreRModeCard(card, services.fsrsService, scoreOptions, now),
		urgentBelow: rMode.urgentBelow,
	};
}

function groupByNoteName(
	cards: CardSchedulingMeta[],
): Map<string, CardSchedulingMeta[]> {
	const map = new Map<string, CardSchedulingMeta[]>();
	for (const card of cards) {
		const noteName = card.sourceNoteName;
		if (!noteName) continue;
		const bucket = map.get(noteName);
		if (bucket) {
			bucket.push(card);
		} else {
			map.set(noteName, [card]);
		}
	}
	return map;
}
