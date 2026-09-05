import { type ReadonlySignal, useSignal } from "@preact/signals";
import { effect } from "@preact/signals-core";
import { useEffect, useMemo } from "preact/hooks";

import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import { Q, useQuery } from "@true-recall/obsidian/data";
import { filterActiveCards } from "@true-recall/obsidian/features/study/ui/review/helpers/session-helpers";
import { useGatedComputed, usePlugin } from "@true-recall/obsidian/preact";

import type {
	DashboardAggregation,
	DashboardNoteEntry,
	DashboardProjectAggregation,
} from "../types";
import {
	buildDashboardAggregation,
	createDashboardSnapshotContext,
} from "./dashboard-aggregation";
import { aggregateProjectData } from "./project-aggregation";

// While the dashboard is visible, Q.ALL_META changes (every review grade)
// recompute the aggregation at most this often; while hidden, not at all.
const RECOMPUTE_THROTTLE_MS = 2000;
const MINUTE_MS = 60_000;

interface UseDashboardDataOptions {
	isViewVisible: ReadonlySignal<boolean>;
	showArchived: boolean;
}

export interface DashboardData {
	data: DashboardAggregation;
	/** Notes shown in the Notes tab, with project membership and preset. */
	notes: DashboardNoteEntry[];
	projectData: DashboardProjectAggregation;
}

/**
 * Card-derived data for the dashboard: note rows, project tree and the
 * global header, all computed from one frozen snapshot of the card store.
 */
export function useDashboardData({
	isViewVisible,
	showArchived,
}: UseDashboardDataOptions): DashboardData {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const archivedSourceUidsSignal = useQuery<ReadonlySet<string>>(
		Q.ARCHIVED_UIDS,
	);
	const minuteBucket = useSignal(Math.floor(Date.now() / MINUTE_MS));

	// Retrievability changes with time even when no card metadata changes. Keep
	// the dashboard honest without waking a hidden view every minute.
	useEffect(() => {
		return effect(() => {
			if (!isViewVisible.value) return;
			minuteBucket.value = Math.floor(Date.now() / MINUTE_MS);
			const timer = window.setInterval(() => {
				minuteBucket.value = Math.floor(Date.now() / MINUTE_MS);
			}, MINUTE_MS);
			return () => window.clearInterval(timer);
		});
	}, [isViewVisible, minuteBucket]);

	const statsCalculator = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
			plugin.settings.dayStartHour,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	// One gated snapshot for all card-derived data: while this leaf is hidden
	// the hot signals are not even subscribed, so grading in the review view
	// no longer re-renders or recomputes the dashboard aggregation. Downstream
	// useMemos stay stable because both references are frozen together.
	const { allCards, archived, now } = useGatedComputed(
		() => ({
			allCards: [...allMeta.value.values()],
			archived: archivedSourceUidsSignal.value,
			now: new Date(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS),
		}),
		() => {
			// Subscribe to the timer without making its catch-up write on reveal a
			// separate dependency from the current wall-clock minute.
			void minuteBucket.value;
			return [
				allMeta.value,
				archivedSourceUidsSignal.value,
				Math.floor(Date.now() / MINUTE_MS),
			];
		},
		{ isVisible: isViewVisible, throttleMs: RECOMPUTE_THROTTLE_MS },
	);

	const activeCards = useMemo(
		() =>
			filterActiveCards(allCards, {
				archivedSourceUids: new Set(archived),
			}),
		[allCards, archived],
	);

	// Note, project and global snapshots of one render share a cache and one
	// reading of today's progress, so the same scope is never built twice.
	const snapshotContext = useMemo(
		() => createDashboardSnapshotContext(plugin.sessionPersistence),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- progress must be re-read whenever the card snapshot changes
		[plugin, allCards, archived, now],
	);

	const services = useMemo(
		() => ({
			settings: plugin.settings,
			sessionPersistence: plugin.sessionPersistence,
			presetService: plugin.presetService,
			hierarchyService: plugin.hierarchyService,
			fsrsService: plugin.fsrsService,
			metadataCache: plugin.app.metadataCache,
			cardStore: plugin.cardStore,
		}),
		[plugin],
	);

	const data = useMemo(
		() =>
			buildDashboardAggregation({
				allCards,
				activeCards,
				archivedSourceUids: archived,
				showArchived,
				now,
				streakCurrent: statsCalculator.getStreakInfo().current,
				todaySummary: statsCalculator.getTodaySummary(),
				snapshotContext,
				services,
			}),
		[
			allCards,
			activeCards,
			archived,
			showArchived,
			now,
			statsCalculator,
			snapshotContext,
			services,
		],
	);

	const visibleNotes = useMemo(() => {
		if (showArchived) return data.notes;
		return data.notes.filter(
			(note) =>
				!note.path || !plugin.hierarchyService.isNoteArchived(note.path),
		);
	}, [data.notes, plugin, showArchived]);

	const projectData = useMemo(
		() =>
			aggregateProjectData({
				notes: visibleNotes,
				showArchived,
				now,
				snapshotContext,
				services: {
					...services,
					allCards,
					archivedSourceUids: archived,
					activeCards,
				},
			}),
		[
			visibleNotes,
			showArchived,
			now,
			snapshotContext,
			services,
			allCards,
			archived,
			activeCards,
		],
	);

	const notes = useMemo(
		() =>
			visibleNotes.map((note) => ({
				...note,
				projects: projectData.noteProjectMap.get(note.name) ?? [],
				presetName: note.path
					? plugin.presetService.resolvePresetChain(note.path).effective.preset
							.name
					: undefined,
				archived: note.path
					? plugin.hierarchyService.isNoteArchived(note.path)
					: false,
			})),
		[visibleNotes, projectData.noteProjectMap, plugin],
	);

	return { data, notes, projectData };
}
