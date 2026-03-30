import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import type { FSRSService } from "@features/core/services/fsrs.service";
import type {
	HierarchyService,
	HierarchyTreeNode,
} from "@features/core/services/hierarchy.service";
import type { PresetService } from "@features/core/services/preset.service";
import {
	type ActionableSessionSnapshot,
	computeActionableSessionSnapshot,
} from "@features/study/services/actionable-session-snapshot.service";
import { UNASSIGNED_PATH } from "@shared/constants";
import type { FSRSFlashcardItem, TrueRecallSettings } from "@shared/types";
import type { CardStore } from "@shared/types/fsrs/store.types";
import type { MetadataCache } from "obsidian";
import { State } from "ts-fsrs";
import {
	computeProjectStats,
	type ProjectStats,
} from "../../editor/widgets/project-stats";
import type {
	DashboardNoteEntry,
	DashboardProject,
	DashboardProjectAggregation,
} from "../types";

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
		allCards: FSRSFlashcardItem[];
		archivedSourceUids: ReadonlySet<string>;
		activeCards: FSRSFlashcardItem[];
		metadataCache: MetadataCache;
	};
}

const MAX_RECENTLY_STUDIED = 5;

interface ProjectAggregationIndexes {
	allCardsBySourceUid: Map<
		string,
		import("@shared/types/fsrs/card.types").FSRSCardData[]
	>;
	activeCardsBySourceUid: Map<string, FSRSFlashcardItem[]>;
	retrievabilityByCardId: Map<string, number>;
	now: Date;
}

function buildCardsBySourceUid(
	cards: FSRSFlashcardItem[],
): Map<string, import("@shared/types/fsrs/card.types").FSRSCardData[]> {
	const map = new Map<
		string,
		import("@shared/types/fsrs/card.types").FSRSCardData[]
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
	cards: FSRSFlashcardItem[],
): Map<string, FSRSFlashcardItem[]> {
	const map = new Map<string, FSRSFlashcardItem[]>();
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
	activeCardsBySourceUid: ReadonlyMap<string, FSRSFlashcardItem[]>,
): FSRSFlashcardItem[] {
	const collected: FSRSFlashcardItem[] = [];
	for (const uid of sourceUids) {
		const cards = activeCardsBySourceUid.get(uid);
		if (!cards || cards.length === 0) continue;
		collected.push(...cards);
	}
	return collected;
}

function buildRetrievabilityCache(
	cardsBySourceUid: ReadonlyMap<
		string,
		import("@shared/types/fsrs/card.types").FSRSCardData[]
	>,
	fsrsService: FSRSService,
	now: Date,
): Map<string, number> {
	const cache = new Map<string, number>();
	for (const cards of cardsBySourceUid.values()) {
		for (const card of cards) {
			if (card.state === State.New) continue;
			cache.set(card.id, fsrsService.getRetrievability(card, now));
		}
	}
	return cache;
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
	const retrievabilityByCardId = buildRetrievabilityCache(
		allCardsBySourceUid,
		plugin.fsrsService,
		now,
	);
	const indexes: ProjectAggregationIndexes = {
		allCardsBySourceUid,
		activeCardsBySourceUid,
		retrievabilityByCardId,
		now,
	};

	const allProjects = hierarchy.map((node) =>
		buildProjectFromNode(node, noteByPath, plugin, snapshotCache, indexes),
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
			retrievabilityByCardId: indexes.retrievabilityByCardId,
			now: indexes.now,
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
		buildProjectFromNode(child, noteByPath, plugin, snapshotCache, indexes),
	);

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

	const preset = plugin.presetService.resolvePresetChain(node.path).effective
		.preset;
	const presetName = preset.name;

	return {
		name: stats.name,
		path: stats.path,
		healthPct: stats.healthPct,
		newCount: snapshot.counts.new,
		learning: snapshot.counts.learning,
		due: snapshot.counts.due,
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
