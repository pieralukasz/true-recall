import type { MetadataCache } from "obsidian";
import { State } from "ts-fsrs";

import { UNASSIGNED_PATH } from "@true-recall/core/constants";
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
import type { CardStore } from "@true-recall/core/types/fsrs/store.types";

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
	type ProjectStats,
} from "@true-recall/plugins/dashboard-codeblock/project-stats";

export { UNASSIGNED_PATH };

interface ProjectAggregationDeps {
	notes: DashboardNoteEntry[];
	showArchived?: boolean;
	plugin: {
		hierarchyService: HierarchyService;
		cardStore: CardStore;
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
): { newCount: number; learning: number; due: number } {
	let newCount = 0;
	let learning = 0;
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
					learning++;
					break;
				case State.Review:
					if (new Date(card.due) <= now) due++;
					break;
			}
		}
	}
	return { newCount, learning, due };
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
	const now = new Date();
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

	// Sort: most active (due + new + learning) first
	projects.sort((a, b) => {
		const aActive = a.due + a.newCount + a.learning;
		const bActive = b.due + b.newCount + b.learning;
		return bActive - aActive;
	});

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
			due: unassignedNotes.reduce((s, n) => s + n.due, 0),
			totalCards: unassignedNotes.reduce((s, n) => s + n.total, 0),
			childCount: 0,
			lastReviewed: null,
			totalMembers: unassignedNotes.length,
			memberNotes: unassignedNotes,
			children: [],
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

	let counts: { new: number; learning: number; due: number };
	if (isArchived) {
		const raw = computeRawCounts(
			sourceUids,
			indexes.allCardsBySourceUid,
			indexes.now,
		);
		counts = { new: raw.newCount, learning: raw.learning, due: raw.due };
	} else {
		const scopedActiveCards = collectActiveCardsForSources(
			sourceUids,
			indexes.activeCardsBySourceUid,
		);
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
			{ projectPath: node.path },
			{ cache: snapshotCache, activeCards: scopedActiveCards },
		);
		counts = snapshot.counts;
	}

	const preset = plugin.presetService.resolvePresetChain(node.path).effective
		.preset;
	const presetName = preset.name;

	return {
		name: stats.name,
		path: stats.path,
		healthPct: stats.healthPct,
		newCount: counts.new,
		learning: counts.learning,
		due: counts.due,
		totalCards: stats.totalCards,
		childCount: stats.childCount,
		lastReviewed: stats.lastReviewed,
		totalMembers:
			memberNotes.length + children.reduce((sum, c) => sum + c.totalMembers, 0),
		memberNotes,
		children,
		presetName,
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
