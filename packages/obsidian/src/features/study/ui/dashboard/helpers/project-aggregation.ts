import type { MetadataCache } from "obsidian";
import { State } from "ts-fsrs";

import { UNASSIGNED_PATH } from "@true-recall/core/constants";
import { mergeRetrievability } from "@true-recall/core/helpers/note-aggregation";
import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	HierarchyService,
	HierarchyTreeNode,
} from "@true-recall/core/services/notes/hierarchy.service";
import type { PresetService } from "@true-recall/core/services/notes/preset.service";
import { summarizeRetrievability } from "@true-recall/core/services/review/retrievability-queue";
import type {
	CardSchedulingMeta,
	TrueRecallSettings,
} from "@true-recall/core/types";

import {
	type ActionableSessionSnapshot,
	computeActionableSessionSnapshot,
} from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";

import type {
	DashboardNoteEntry,
	DashboardProject,
	DashboardProjectAggregation,
} from "../types";
import {
	computeProjectStats,
	type ProjectCardStore,
	type ProjectStats,
} from "@true-recall/plugins/dashboard-codeblock/project-stats";

export { UNASSIGNED_PATH };

interface ProjectAggregationDeps {
	notes: DashboardNoteEntry[];
	showArchived?: boolean;
	now?: Date;
	plugin: {
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
	};
}

const MAX_RECENTLY_STUDIED = 5;

interface ProjectAggregationIndexes {
	allCardsBySourceUid: Map<
		string,
		import("@true-recall/core/types/fsrs/card.types").FSRSCardData[]
	>;
	activeCardsBySourceUid: Map<string, CardSchedulingMeta[]>;
	now: Date;
}

function buildCardsBySourceUid(
	cards: CardSchedulingMeta[],
): Map<
	string,
	import("@true-recall/core/types/fsrs/card.types").FSRSCardData[]
> {
	const map = new Map<
		string,
		import("@true-recall/core/types/fsrs/card.types").FSRSCardData[]
	>();
	for (const card of cards) {
		const uid = card.sourceUid ?? card.fsrs.sourceUid;
		if (!uid) continue;
		const bucket = map.get(uid);
		const fsrs = card.fsrs.sourceUid
			? card.fsrs
			: { ...card.fsrs, sourceUid: uid };
		if (bucket) {
			bucket.push(fsrs);
		} else {
			map.set(uid, [fsrs]);
		}
	}
	return map;
}

function buildActiveCardsBySourceUid(
	cards: CardSchedulingMeta[],
): Map<string, CardSchedulingMeta[]> {
	const map = new Map<string, CardSchedulingMeta[]>();
	for (const card of cards) {
		const uid = card.sourceUid ?? card.fsrs.sourceUid ?? "";
		if (!uid) continue;
		const bucket = map.get(uid);
		if (bucket) {
			bucket.push(card);
		} else {
			map.set(uid, [card]);
		}
	}
	return map;
}

function collectActiveCardsForSources(
	sourceUids: ReadonlySet<string>,
	activeCardsBySourceUid: ReadonlyMap<string, CardSchedulingMeta[]>,
): CardSchedulingMeta[] {
	const collected: CardSchedulingMeta[] = [];
	for (const uid of sourceUids) {
		const cards = activeCardsBySourceUid.get(uid);
		if (!cards || cards.length === 0) continue;
		collected.push(...cards);
	}
	return collected;
}

function computeRawCounts(
	sourceUids: ReadonlySet<string>,
	allCardsBySourceUid: ProjectAggregationIndexes["allCardsBySourceUid"],
	now: Date,
): {
	newCount: number;
	learning: number;
	learningPending: number;
	due: number;
} {
	let newCount = 0;
	let learning = 0;
	let learningPending = 0;
	let due = 0;
	for (const uid of sourceUids) {
		const cards = allCardsBySourceUid.get(uid);
		if (!cards) continue;
		for (const card of cards) {
			if (card.suspended) continue;
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;
			switch (card.state) {
				case State.New:
					newCount++;
					break;
				case State.Learning:
				case State.Relearning:
					if (new Date(card.due) <= now) learning++;
					else learningPending++;
					break;
				case State.Review:
					if (new Date(card.due) <= now) due++;
					break;
			}
		}
	}
	return { newCount, learning, learningPending, due };
}

export function aggregateProjectData(
	deps: ProjectAggregationDeps,
): DashboardProjectAggregation {
	const { notes, showArchived, plugin } = deps;

	// O(1) lookups for notes by path and by name
	const noteByPath = new Map<string, DashboardNoteEntry>();
	for (const note of notes) {
		if (note.path) noteByPath.set(note.path, note);
	}

	const hierarchy = plugin.hierarchyService.buildHierarchy();
	const snapshotCache = new Map<string, ActionableSessionSnapshot>();
	const now = deps.now ?? new Date();
	const allCardsBySourceUid = buildCardsBySourceUid(plugin.allCards);
	const activeCardsBySourceUid = buildActiveCardsBySourceUid(
		plugin.activeCards,
	);
	const indexes: ProjectAggregationIndexes = {
		allCardsBySourceUid,
		activeCardsBySourceUid,
		now,
	};

	const allProjects = hierarchy.map((node) =>
		buildProjectFromNode(
			node,
			noteByPath,
			plugin,
			snapshotCache,
			indexes,
			showArchived,
		),
	);

	let projects: DashboardProject[];
	if (showArchived) {
		// Keep all projects, tag archived ones
		projects = allProjects.map((p) => ({
			...p,
			archived: plugin.hierarchyService.isProjectArchived(p.path),
		}));
	} else {
		projects = allProjects.filter(
			(p) => !plugin.hierarchyService.isProjectArchived(p.path),
		);
	}

	// Build reverse map: note name → project names
	const noteProjectMap = buildNoteProjectMap(projects);

	// Collect all project file paths so project notes with flashcards don't appear in Unassigned
	const projectPaths = new Set<string>();
	function collectProjectPaths(projs: DashboardProject[]) {
		for (const p of projs) {
			if (p.path) projectPaths.add(p.path);
			collectProjectPaths(p.children);
		}
	}
	collectProjectPaths(allProjects);

	// Virtual "Unassigned" project for orphan notes
	const assignedNoteNames = new Set(noteProjectMap.keys());
	const unassignedNotes = notes.filter(
		(n) =>
			!assignedNoteNames.has(n.name) && !(n.path && projectPaths.has(n.path)),
	);
	if (unassignedNotes.length > 0) {
		projects.push({
			name: "Unassigned",
			path: UNASSIGNED_PATH,
			healthPct: 0,
			newCount: unassignedNotes.reduce((s, n) => s + n.newCount, 0),
			learning: unassignedNotes.reduce((s, n) => s + n.learning, 0),
			learningPending: unassignedNotes.reduce(
				(s, n) => s + (n.learningPending ?? 0),
				0,
			),
			due: unassignedNotes.reduce((s, n) => s + n.due, 0),
			totalCards: unassignedNotes.reduce((s, n) => s + n.total, 0),
			childCount: 0,
			lastReviewed: null,
			totalMembers: unassignedNotes.length,
			memberNotes: unassignedNotes,
			children: [],
			retrievability: mergeRetrievability(
				unassignedNotes.map((n) => n.retrievability),
			),
		});
	}

	// Recently studied: top N notes sorted by lastReview desc
	const recentlyStudied = [...notes]
		.filter((n) => n.lastReview)
		.sort((a, b) => (b.lastReview ?? "").localeCompare(a.lastReview ?? ""))
		.slice(0, MAX_RECENTLY_STUDIED);

	return { projects, noteProjectMap, recentlyStudied };
}

function buildProjectFromNode(
	node: HierarchyTreeNode,
	noteByPath: Map<string, DashboardNoteEntry>,
	plugin: ProjectAggregationDeps["plugin"],
	snapshotCache: Map<string, ActionableSessionSnapshot>,
	indexes: ProjectAggregationIndexes,
	showArchived?: boolean,
): DashboardProject {
	const sourceUids = plugin.hierarchyService.getSourceUidsForProject(node.path);
	const stats: ProjectStats = computeProjectStats(
		node.path,
		node.name,
		node.children.length,
		plugin.hierarchyService,
		plugin.cardStore,
		plugin.fsrsService,
		{
			sourceUids,
			cardsBySourceUid: indexes.allCardsBySourceUid,
			now: indexes.now,
			skipHealthPct: true,
		},
	);

	// Resolve member notes from paths (include 0-card notes that belong to this project)
	const memberNotes: DashboardNoteEntry[] = [];
	for (const memberPath of node.memberPaths) {
		const note = noteByPath.get(memberPath);
		if (note) {
			memberNotes.push(note);
		} else {
			const name =
				memberPath.split("/").pop()?.replace(/\.md$/, "") ?? memberPath;
			memberNotes.push({
				name,
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
			});
		}
	}

	const children = node.children.map((child) =>
		buildProjectFromNode(
			child,
			noteByPath,
			plugin,
			snapshotCache,
			indexes,
			showArchived,
		),
	);

	const isArchived =
		showArchived && plugin.hierarchyService.isProjectArchived(node.path);
	const scopedActiveCards = collectActiveCardsForSources(
		sourceUids,
		indexes.activeCardsBySourceUid,
	);

	let counts: {
		new: number;
		learning: number;
		learningPending: number;
		due: number;
	};
	if (isArchived) {
		const raw = computeRawCounts(
			sourceUids,
			indexes.allCardsBySourceUid,
			indexes.now,
		);
		counts = {
			new: raw.newCount,
			learning: raw.learning,
			learningPending: raw.learningPending,
			due: raw.due,
		};
	} else {
		const snapshot = computeActionableSessionSnapshot(
			{
				allCards: plugin.allCards,
				archivedSourceUids: plugin.archivedSourceUids,
				settings: plugin.settings,
				sessionPersistence: plugin.sessionPersistence,
				presetService: plugin.presetService,
				metadataCache: plugin.metadataCache,
				hierarchyService: plugin.hierarchyService,
				fsrsService: plugin.fsrsService,
			},
			{
				projectPath: node.path,
				schedulingMode: plugin.settings.rMode.enabled
					? "retrievability"
					: "due",
			},
			{ cache: snapshotCache, activeCards: scopedActiveCards },
		);
		counts = snapshot.counts;
	}

	const preset = plugin.presetService.resolvePresetChain(node.path).effective
		.preset;
	const presetName = preset.name;

	const rMode = plugin.settings.rMode;
	const reviewCards = scopedActiveCards.filter(
		(card) => card.fsrs.state === State.Review,
	);
	const presetCache = new Map<string, typeof preset>();
	const summary =
		rMode.enabled && !isArchived
			? summarizeRetrievability(
					reviewCards,
					plugin.fsrsService,
					{
						ceiling: Math.min(
							0.999,
							preset.requestRetention + rMode.ceilingOffset,
						),
						comfortFloor: preset.requestRetention,
						urgentBelow: rMode.urgentBelow,
						resolveCardOptions: (card) => {
							const key = card.sourceUid ?? card.id;
							let cardPreset = presetCache.get(key);
							if (!cardPreset) {
								cardPreset = plugin.presetService.resolvePresetForCard(card, {
									projectPath: node.path,
								});
								presetCache.set(key, cardPreset);
							}
							return {
								comfortFloor: cardPreset.requestRetention,
								ceiling: Math.min(
									0.999,
									cardPreset.requestRetention + rMode.ceilingOffset,
								),
								presetSettings: plugin.presetService.toFSRSSettings(cardPreset),
							};
						},
					},
					indexes.now,
				)
			: null;
	const retrievability = summary
		? {
				urgent: summary.urgent,
				losing: summary.losing,
				known: summary.known,
				fresh: summary.fresh,
				pool: summary.pool,
				total: summary.total,
				sumR: summary.sumR,
			}
		: mergeRetrievability([
				...memberNotes.map((note) => note.retrievability),
				...children.map((child) => child.retrievability),
			]);

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
			memberNotes.length + children.reduce((sum, c) => sum + c.totalMembers, 0),
		memberNotes,
		children,
		presetName,
		retrievability,
	};
}

function buildNoteProjectMap(
	projects: DashboardProject[],
): Map<string, string[]> {
	const map = new Map<string, string[]>();

	function walk(project: DashboardProject) {
		for (const note of project.memberNotes) {
			const existing = map.get(note.name);
			if (existing) {
				existing.push(project.name);
			} else {
				map.set(note.name, [project.name]);
			}
		}
		for (const child of project.children) {
			walk(child);
		}
	}

	for (const p of projects) walk(p);
	return map;
}
