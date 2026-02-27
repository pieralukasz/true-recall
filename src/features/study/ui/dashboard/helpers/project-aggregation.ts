import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
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
		frontmatterIndex?: FrontmatterIndexService;
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

	// Build reverse map: note name → project names
	const noteProjectMap = buildNoteProjectMap(projects);

	// Recently studied: top N notes sorted by lastReview desc
	const recentlyStudied = [...notes]
		.filter((n) => n.lastReview)
		.sort((a, b) => b.lastReview!.localeCompare(a.lastReview!))
		.slice(0, MAX_RECENTLY_STUDIED);

	return { projects, noteProjectMap, recentlyStudied };
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

	const presetName = plugin.frontmatterIndex
		? lookupPresetName(plugin.frontmatterIndex, node.path)
		: undefined;

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

function lookupPresetName(
	frontmatterIndex: FrontmatterIndexService,
	path: string,
): string | undefined {
	const values = frontmatterIndex.getValues("fsrs_preset", path);
	return values.length > 0 && values[0] ? values[0] : undefined;
}
