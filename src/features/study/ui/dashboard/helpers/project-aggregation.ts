import type { FSRSService } from "@features/core/services/fsrs.service";
import type {
	ProjectLinkService,
	ProjectNode,
} from "@features/core/services/project-link.service";
import type { CardStore } from "@shared/types/fsrs/store.types";
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
	plugin: {
		projectLinkService: ProjectLinkService;
		cardStore: CardStore;
		fsrsService: FSRSService;
	};
}

const MAX_RECENTLY_STUDIED = 5;

export function aggregateProjectData(
	deps: ProjectAggregationDeps,
): DashboardProjectAggregation {
	const { notes, plugin } = deps;

	// O(1) lookups for notes by path and by name
	const noteByPath = new Map<string, DashboardNoteEntry>();
	const noteByName = new Map<string, DashboardNoteEntry>();
	for (const note of notes) {
		if (note.path) noteByPath.set(note.path, note);
		noteByName.set(note.name, note);
	}

	const hierarchy = plugin.projectLinkService.buildHierarchy();

	const projects = hierarchy.map((node) =>
		buildProjectFromNode(node, noteByPath, noteByName, plugin),
	);

	// Sort: most active (due + new + learning) first
	projects.sort((a, b) => {
		const aActive = a.due + a.newCount + a.learning;
		const bActive = b.due + b.newCount + b.learning;
		return bActive - aActive;
	});

	// Unassigned notes
	const unassignedPaths = plugin.projectLinkService.getUnassignedPaths();
	const unassignedNotes: DashboardNoteEntry[] = [];
	for (const path of unassignedPaths) {
		const note = noteByPath.get(path);
		if (note) unassignedNotes.push(note);
	}

	// Recently studied: top N notes sorted by lastReview desc
	const recentlyStudied = [...notes]
		.filter((n) => n.lastReview)
		.sort((a, b) => b.lastReview!.localeCompare(a.lastReview!))
		.slice(0, MAX_RECENTLY_STUDIED);

	return { projects, unassignedNotes, recentlyStudied };
}

function buildProjectFromNode(
	node: ProjectNode,
	noteByPath: Map<string, DashboardNoteEntry>,
	noteByName: Map<string, DashboardNoteEntry>,
	plugin: ProjectAggregationDeps["plugin"],
): DashboardProject {
	const stats: ProjectStats = computeProjectStats(
		node.path,
		node.name,
		node.children.length,
		plugin.projectLinkService,
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
		buildProjectFromNode(child, noteByPath, noteByName, plugin),
	);

	return {
		name: stats.name,
		path: stats.path,
		healthPct: stats.healthPct,
		newCount: stats.newCount,
		learning: stats.learning,
		due: stats.due,
		totalCards: stats.totalCards,
		childCount: stats.childCount,
		lastReviewed: stats.lastReviewed,
		memberNotes,
		children,
	};
}
