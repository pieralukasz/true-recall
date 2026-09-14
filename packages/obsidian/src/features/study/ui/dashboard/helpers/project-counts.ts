import { State } from "ts-fsrs";

import {
	resolveRModeCeiling,
	summarizeRetrievability,
} from "@true-recall/core/services/review/retrievability-queue";
import { createRModeCardOptionsResolver } from "@true-recall/core/services/review/rmode-card-options";
import type { CardSchedulingMeta, FSRSPreset } from "@true-recall/core/types";
import type {
	DashboardNoteEntry,
	NoteRetrievability,
} from "@true-recall/core/types/dashboard.types";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";

import { computeActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";

import type { ProjectAggregationServices } from "./project-aggregation";
import type {
	ProjectAggregationIndexes,
	ProjectCounts,
} from "./project-aggregation-indexes";
import type { DashboardSnapshotContext } from "./snapshot-context";

/** Everything a project node needs beyond itself while the tree is built. */
export interface ProjectBuildContext {
	noteByPath: ReadonlyMap<string, DashboardNoteEntry>;
	services: ProjectAggregationServices;
	snapshotContext: DashboardSnapshotContext;
	indexes: ProjectAggregationIndexes;
	showArchived: boolean;
}

/** Counts of the session a play button on this row would start. */
export function computeSessionCounts(
	scope: Pick<SessionFilters, "projectPath" | "sourceNoteFilters">,
	scopedActiveCards: CardSchedulingMeta[],
	context: ProjectBuildContext,
): ProjectCounts {
	const { services, snapshotContext, indexes } = context;
	const snapshot = computeActionableSessionSnapshot(
		{
			allCards: services.allCards,
			archivedSourceUids: services.archivedSourceUids,
			settings: services.settings,
			sessionPersistence: services.sessionPersistence,
			presetService: services.presetService,
			metadataCache: services.metadataCache,
			hierarchyService: services.hierarchyService,
			fsrsService: services.fsrsService,
		},
		{
			...scope,
			schedulingMode: services.settings.rMode.enabled
				? "retrievability"
				: "due",
		},
		{
			cache: snapshotContext.cache,
			activeCards: scopedActiveCards,
			sessionProgress: snapshotContext.sessionProgress,
			now: indexes.now,
		},
	);
	return snapshot.counts;
}

export function summarizeProjectRetrievability(
	projectPath: string,
	preset: FSRSPreset,
	scopedActiveCards: CardSchedulingMeta[],
	context: ProjectBuildContext,
): NoteRetrievability | undefined {
	const { services, indexes } = context;
	const { rMode } = services.settings;
	if (!rMode.enabled) return undefined;

	const reviewCards = scopedActiveCards.filter(
		(card) => card.fsrs.state === State.Review,
	);
	const summary = summarizeRetrievability(
		reviewCards,
		services.fsrsService,
		{
			ceiling: resolveRModeCeiling(
				preset.requestRetention,
				rMode.ceilingOffset,
			),
			comfortFloor: preset.requestRetention,
			urgentBelow: rMode.urgentBelow,
			resolveCardOptions: createRModeCardOptionsResolver({
				presetService: services.presetService,
				ceilingOffset: rMode.ceilingOffset,
				projectPath,
			}),
		},
		indexes.now,
	);
	return {
		urgent: summary.urgent,
		losing: summary.losing,
		known: summary.known,
		fresh: summary.fresh,
		pool: summary.pool,
		total: summary.total,
		sumR: summary.sumR,
	};
}
