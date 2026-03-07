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
import type { FSRSFlashcardItem, TrueRecallSettings } from "@shared/types";
import type { CardStore } from "@shared/types/fsrs/store.types";
import type { MetadataCache } from "obsidian";
import {
	computeProjectStats,
	type ProjectStats,
} from "../../editor/widgets/project-stats";
import type {
	DashboardNoteEntry,
	DashboardProject,
	DashboardProjectAggregation,
} from "../types";

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

export const UNASSIGNED_PATH = "__unassigned__";

const MAX_RECENTLY_STUDIED = 5;

export function aggregateProjectData(
	deps: ProjectAggregationDeps,
): DashboardProjectAggregation {
	const { notes, showArchived, plugin } = deps;

	// O(1) lookups for notes by path and by name
	const noteByPath = new Map<string, DashboardNoteEntry>();
	const noteByName = new Map<string, DashboardNoteEntry>();
	for (const note of notes) {
		if (note.path) noteByPath.set(note.path, note);
		noteByName.set(note.name, note);
	}

	const hierarchy = plugin.hierarchyService.buildHierarchy();
	const snapshotCache = new Map<string, ActionableSessionSnapshot>();

	const allProjects = hierarchy.map((node) =>
		buildProjectFromNode(node, noteByPath, noteByName, plugin, snapshotCache),
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

	// Virtual "Unassigned" project for orphan notes
	const assignedNoteNames = new Set(noteProjectMap.keys());
	const unassignedNotes = notes.filter((n) => !assignedNoteNames.has(n.name));
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
	noteByName: Map<string, DashboardNoteEntry>,
	plugin: ProjectAggregationDeps["plugin"],
	snapshotCache: Map<string, ActionableSessionSnapshot>,
): DashboardProject {
	const stats: ProjectStats = computeProjectStats(
		node.path,
		node.name,
		node.children.length,
		plugin.hierarchyService,
		plugin.cardStore,
		plugin.fsrsService,
	);

	// Resolve member notes from paths
	const memberNotes: DashboardNoteEntry[] = [];
	for (const memberPath of node.memberPaths) {
		const note = noteByPath.get(memberPath);
		if (note) memberNotes.push(note);
	}

	const children = node.children.map((child) =>
		buildProjectFromNode(child, noteByPath, noteByName, plugin, snapshotCache),
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
		{ cache: snapshotCache, activeCards: plugin.activeCards },
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
		totalMembers: memberNotes.length,
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
