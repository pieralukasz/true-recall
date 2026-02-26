import type { ProjectNode } from "@features/core/services/project-link.service";
import { dataVersion, metadataVersion, useSignalVersion } from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { ProjectCard } from "./ProjectWidget";
import { computeProjectStats, type ProjectStats } from "../project-stats";

interface FlatProject {
	stats: ProjectStats;
	depth: number;
}

export function ProjectHubWidget() {
	const plugin = usePlugin();
	const ver = useSignalVersion(dataVersion, metadataVersion);

	const projects = useMemo((): FlatProject[] => {
		if (!plugin.cardStore) return [];

		const hierarchy = plugin.projectLinkService.buildHierarchy();
		const flat: FlatProject[] = [];

		const flatten = (nodes: ProjectNode[], depth: number) => {
			for (const node of nodes) {
				const stats = computeProjectStats(
					node.path,
					node.name,
					node.children.length,
					plugin.projectLinkService,
					plugin.cardStore,
					plugin.fsrsService,
				);
				flat.push({ stats, depth });
				flatten(node.children, depth + 1);
			}
		};

		flatten(hierarchy, 0);

		// Sort roots by due count desc (most urgent first), keep children after their parent
		return sortByUrgency(flat);
	}, [plugin, ver]);

	if (projects.length === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No projects found. Create a note with <code>project: true</code> in
				frontmatter to get started.
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
						plugin.app.workspace.openLinkText(stats.path, "", false);
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
						const members = plugin.projectLinkService.getMemberPaths(
							stats.path,
						);
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
	// Split into root-level blocks
	const blocks: FlatProject[][] = [];
	for (const item of flat) {
		if (item.depth === 0) {
			blocks.push([item]);
		} else {
			blocks[blocks.length - 1]?.push(item);
		}
	}

	// Sort blocks by root due count descending
	blocks.sort((a, b) => {
		const aDue = a[0]?.stats.due ?? 0;
		const bDue = b[0]?.stats.due ?? 0;
		return bDue - aDue;
	});

	return blocks.flat();
}
