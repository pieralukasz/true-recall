import { useComputed } from "@preact/signals";
import type { HierarchyTreeNode } from "@true-recall/core/services/notes/hierarchy.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";
import { computeProjectStats, type ProjectStats } from "../project-stats";
import { ProjectCard } from "./ProjectWidget";

interface FlatProject {
	stats: ProjectStats;
	depth: number;
}

export function ProjectHubWidget() {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const archivedUids = useQuery<ReadonlySet<string>>(Q.ARCHIVED_UIDS);

	const projects = useComputed((): FlatProject[] => {
		void allMeta.value;
		const archived = archivedUids.value;
		if (!plugin.cardStore) return [];

		const hierarchy = plugin.hierarchyService.buildHierarchy();
		const flat: FlatProject[] = [];

		const flatten = (nodes: HierarchyTreeNode[], depth: number) => {
			for (const node of nodes) {
				if (plugin.hierarchyService.isProjectArchived(node.path)) continue;

				const allSourceUids = plugin.hierarchyService.getSourceUidsForProject(
					node.path,
				);
				const filteredUids = new Set(
					[...allSourceUids].filter((uid) => !archived.has(uid)),
				);

				const stats = computeProjectStats(
					node.path,
					node.name,
					node.children.length,
					plugin.hierarchyService,
					plugin.cardStore,
					plugin.fsrsService,
					{ sourceUids: filteredUids },
				);
				flat.push({ stats, depth });
				flatten(node.children, depth + 1);
			}
		};

		flatten(hierarchy, 0);

		return sortByUrgency(flat);
	}).value;

	if (projects.length === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No projects found. Add <code>parents: ["[[project note]]"]</code> to
				child notes to create a project hierarchy.
			</div>
		);
	}

	return (
		<div class="ep:grid ep:grid-cols-1 ep:gap-2 ep:p-1">
			{projects.map(({ stats, depth }) => (
				<ProjectCard
					key={stats.path}
					stats={stats}
					depth={depth}
					onClickName={() => {
						void plugin.app.workspace.openLinkText(stats.path, "", false);
					}}
					onReview={() => {
						plugin
							.openReviewViewWithFilters({
								projectPath: stats.path,
								ignoreDailyLimits: true,
							})
							.catch(() => {});
					}}
					onCustomStudy={() => {
						const members = plugin.hierarchyService.getChildPaths(stats.path);
						const names = members.map((p) => {
							const f = plugin.app.vault.getAbstractFileByPath(p);
							return f?.name?.replace(/\.md$/, "") ?? p;
						});
						plugin
							.openCustomStudyModal({
								sourceNoteFilters: names,
								scopeLabel: stats.name,
							})
							.catch(() => {});
					}}
				/>
			))}
		</div>
	);
}

/**
 * Sort so root projects appear by urgency (due desc), but children
 * stay grouped under their parent. We do this by sorting only the
 * root-level blocks (a root + its descendants) by the root's due count.
 */
function sortByUrgency(flat: FlatProject[]): FlatProject[] {
	const blocks: FlatProject[][] = [];
	for (const item of flat) {
		if (item.depth === 0) {
			blocks.push([item]);
		} else {
			blocks[blocks.length - 1]?.push(item);
		}
	}

	blocks.sort((a, b) => {
		const aDue = a[0]?.stats.due ?? 0;
		const bDue = b[0]?.stats.due ?? 0;
		return bDue - aDue;
	});

	return blocks.flat();
}
