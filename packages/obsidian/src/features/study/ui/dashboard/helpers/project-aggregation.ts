import type { MetadataCache } from "obsidian";

import { UNASSIGNED_PATH } from "@true-recall/core/constants";
import { mergeRetrievability } from "@true-recall/core/helpers/note-aggregation";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	HierarchyService,
	HierarchyTreeNode,
} from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import type {
	CardSchedulingMeta,
	TrueRecallSettings,
} from "@true-recall/core/types";

import type {
	DashboardNoteEntry,
	DashboardProject,
	DashboardProjectAggregation,
} from "../types";
import {
	buildProjectAggregationIndexes,
	collectActiveCardsForSources,
	computeRawCounts,
} from "./project-aggregation-indexes";
import {
	computeSessionCounts,
	type ProjectBuildContext,
	summarizeProjectRetrievability,
} from "./project-counts";
import {
	createDashboardSnapshotContext,
	type DashboardSnapshotContext,
} from "./snapshot-context";
import {
	computeProjectStats,
	type ProjectCardStore,
	type ProjectStats,
} from "@true-recall/plugins/dashboard-codeblock/project-stats";

export { UNASSIGNED_PATH };

export interface ProjectAggregationServices {
	hierarchyService: HierarchyService;
	cardStore: ProjectCardStore;
	fsrsService: FSRSService;
	presetService: PresetService;
	sessionPersistence: SessionPersistenceService;
	settings: TrueRecallSettings;
	allCards: CardSchedulingMeta[];
	archivedSourceUids: ReadonlySet<string>;
	activeCards: CardSchedulingMeta[];
	metadataCache: MetadataCache;
}

export interface ProjectAggregationDeps {
	notes: DashboardNoteEntry[];
	showArchived?: boolean;
	now?: Date;
	/** Shared with the note aggregation of the same render when available. */
	snapshotContext?: DashboardSnapshotContext;
	services: ProjectAggregationServices;
}

const MAX_RECENTLY_STUDIED = 5;

export function aggregateProjectData(
	deps: ProjectAggregationDeps,
): DashboardProjectAggregation {
	const { notes, services } = deps;
	const showArchived = deps.showArchived ?? false;

	const noteByPath = new Map<string, DashboardNoteEntry>();
	for (const note of notes) {
		if (note.path) noteByPath.set(note.path, note);
	}

	const context: ProjectBuildContext = {
		noteByPath,
		services,
		snapshotContext:
			deps.snapshotContext ??
			createDashboardSnapshotContext(services.sessionPersistence),
		indexes: buildProjectAggregationIndexes(
			services.allCards,
			services.activeCards,
			deps.now ?? new Date(),
		),
		showArchived,
	};

	const allProjects = services.hierarchyService
		.buildHierarchy()
		.map((node) => buildProjectFromNode(node, context));

	const projects = showArchived
		? allProjects.map((project) => ({
				...project,
				archived: services.hierarchyService.isProjectArchived(project.path),
			}))
		: allProjects.filter(
				(project) => !services.hierarchyService.isProjectArchived(project.path),
			);

	const noteProjectMap = buildNoteProjectMap(projects);

	// Project notes that carry their own flashcards are not "unassigned".
	const projectPaths = collectProjectPaths(allProjects);
	const unassignedNotes = notes.filter(
		(note) =>
			!noteProjectMap.has(note.name) &&
			!(note.path && projectPaths.has(note.path)),
	);
	if (unassignedNotes.length > 0) {
		projects.push(buildUnassignedProject(unassignedNotes, context));
	}

	const recentlyStudied = [...notes]
		.filter((note) => note.lastReview)
		.sort((a, b) => (b.lastReview ?? "").localeCompare(a.lastReview ?? ""))
		.slice(0, MAX_RECENTLY_STUDIED);

	return { projects, noteProjectMap, recentlyStudied };
}

function buildProjectFromNode(
	node: HierarchyTreeNode,
	context: ProjectBuildContext,
): DashboardProject {
	const { services, indexes } = context;
	const sourceUids = services.hierarchyService.getSourceUidsForProject(
		node.path,
	);
	const stats: ProjectStats = computeProjectStats(
		node.path,
		node.name,
		node.children.length,
		services.hierarchyService,
		services.cardStore,
		services.fsrsService,
		{
			sourceUids,
			cardsBySourceUid: indexes.allCardsBySourceUid,
			now: indexes.now,
			skipHealthPct: true,
		},
	);

	const memberNotes = node.memberPaths.map(
		(memberPath) =>
			context.noteByPath.get(memberPath) ?? emptyNoteEntry(memberPath),
	);
	const children = node.children.map((child) =>
		buildProjectFromNode(child, context),
	);

	const isArchived =
		context.showArchived &&
		services.hierarchyService.isProjectArchived(node.path);
	const scopedActiveCards = collectActiveCardsForSources(
		sourceUids,
		indexes.activeCardsBySourceUid,
	);

	const counts = isArchived
		? computeRawCounts(sourceUids, indexes.allCardsBySourceUid, indexes.now)
		: computeSessionCounts(
				{ projectPath: node.path },
				scopedActiveCards,
				context,
			);

	const preset = services.presetService.resolvePresetChain(node.path).effective
		.preset;
	const retrievability = isArchived
		? undefined
		: summarizeProjectRetrievability(
				node.path,
				preset,
				scopedActiveCards,
				context,
			);

	return {
		name: stats.name,
		path: stats.path,
		// In R-Mode health is mean retrievability; the due-based figure describes
		// a schedule that no longer drives anything.
		healthPct:
			retrievability && retrievability.total > 0
				? Math.round((retrievability.sumR / retrievability.total) * 100)
				: stats.healthPct,
		newCount: counts.new,
		learning: counts.learning,
		learningPending: counts.learningPending,
		due: counts.due,
		totalCards: stats.totalCards,
		childCount: stats.childCount,
		lastReviewed: stats.lastReviewed,
		totalMembers:
			memberNotes.length +
			children.reduce((sum, child) => sum + child.totalMembers, 0),
		memberNotes,
		children,
		presetName: preset.name,
		retrievability:
			retrievability ??
			mergeRetrievability([
				...memberNotes.map((note) => note.retrievability),
				...children.map((child) => child.retrievability),
			]),
	};
}

/**
 * The virtual bucket for notes outside every project. It has no path, so its
 * session is scoped by note names, and like every other deck it shows what
 * that session would contain rather than the sum of its note rows (which may
 * ignore daily limits).
 */
function buildUnassignedProject(
	unassignedNotes: DashboardNoteEntry[],
	context: ProjectBuildContext,
): DashboardProject {
	const memberNames = new Set(unassignedNotes.map((note) => note.name));
	const scopedActiveCards = context.services.activeCards.filter(
		(card) => card.sourceNoteName && memberNames.has(card.sourceNoteName),
	);
	const counts = computeSessionCounts(
		{ sourceNoteFilters: [...memberNames] },
		scopedActiveCards,
		context,
	);

	return {
		name: "Unassigned",
		path: UNASSIGNED_PATH,
		healthPct: 0,
		newCount: counts.new,
		learning: counts.learning,
		learningPending: counts.learningPending,
		due: counts.due,
		totalCards: unassignedNotes.reduce((sum, note) => sum + note.total, 0),
		childCount: 0,
		lastReviewed: null,
		totalMembers: unassignedNotes.length,
		memberNotes: unassignedNotes,
		children: [],
		retrievability: mergeRetrievability(
			unassignedNotes.map((note) => note.retrievability),
		),
	};
}

/** A member note without cards still belongs to its project. */
function emptyNoteEntry(memberPath: string): DashboardNoteEntry {
	return {
		name: memberPath.split("/").pop()?.replace(/\.md$/, "") ?? memberPath,
		path: memberPath,
		due: 0,
		newCount: 0,
		learning: 0,
		total: 0,
		lastReview: null,
		overdueDays: 0,
		overdueCount: 0,
		estimatedMinutes: 0,
		priority: "done",
		projects: [],
	};
}

function collectProjectPaths(projects: DashboardProject[]): Set<string> {
	const paths = new Set<string>();
	const walk = (list: DashboardProject[]) => {
		for (const project of list) {
			if (project.path) paths.add(project.path);
			walk(project.children);
		}
	};
	walk(projects);
	return paths;
}

function buildNoteProjectMap(
	projects: DashboardProject[],
): Map<string, string[]> {
	const map = new Map<string, string[]>();
	const walk = (project: DashboardProject) => {
		for (const note of project.memberNotes) {
			const existing = map.get(note.name);
			if (existing) {
				existing.push(project.name);
			} else {
				map.set(note.name, [project.name]);
			}
		}
		for (const child of project.children) walk(child);
	};
	for (const project of projects) walk(project);
	return map;
}
