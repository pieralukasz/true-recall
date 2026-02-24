import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components/Clickable";
import { cn } from "@shared/ui/utils";
import { useIcon } from "@shared/ui/preact/hooks";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import {
	computeProjectStats,
	healthColor,
	type ProjectStats,
} from "../../editor/widgets/project-stats";

export function ProjectsSection() {
	const plugin = usePlugin();
	const isCollapsed = useSignal(false);
	const chevronRef = useIcon(
		isCollapsed.value ? "chevron-right" : "chevron-down",
	);

	const { projects, unassignedCount } = useMemo(() => {
		if (!plugin.cardStore)
			return { projects: [] as ProjectStats[], unassignedCount: 0 };

		const hierarchy = plugin.projectLinkService.buildHierarchy();

		const rootStats: ProjectStats[] = hierarchy.map((node) =>
			computeProjectStats(
				node.path,
				node.name,
				node.children.length,
				plugin.projectLinkService,
				plugin.cardStore,
				plugin.fsrsService,
			),
		);

		rootStats.sort((a, b) => {
			const aActive = a.due + a.newCount + a.learning;
			const bActive = b.due + b.newCount + b.learning;
			return bActive - aActive;
		});

		const unassigned =
			plugin.projectLinkService.getUnassignedPaths().length;

		return { projects: rootStats, unassignedCount: unassigned };
	}, [plugin]);

	if (projects.length === 0) return null;

	return (
		<div>
			<div class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:mb-2">
				<Clickable
					class="ep:flex ep:items-center ep:gap-1.5 ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider ep:hover:text-obs-normal ep:transition-colors"
					aria-expanded={!isCollapsed.value}
					onClick={() => {
						isCollapsed.value = !isCollapsed.value;
					}}
				>
					<span
						ref={chevronRef}
						class="[&_svg]:ep:w-3 [&_svg]:ep:h-3"
					/>
					Projects
				</Clickable>
			</div>

			{!isCollapsed.value && (
				<div class="ep:flex ep:flex-col">
					{projects.map((stats) => (
						<ProjectRow
							key={stats.path}
							stats={stats}
							onReview={() => {
								void plugin.openReviewViewWithFilters({
									projectPath: stats.path,
									ignoreDailyLimits: true,
								});
							}}
						/>
					))}

					{unassignedCount > 0 && (
						<div class="ep:px-3 ep:py-1.5 ep:text-xs ep:text-obs-muted">
							+ {unassignedCount} unassigned note
							{unassignedCount !== 1 ? "s" : ""}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

interface ProjectRowProps {
	stats: ProjectStats;
	onReview: () => void;
}

function ProjectRow({ stats, onReview }: ProjectRowProps) {
	const activeDue = stats.due + stats.newCount + stats.learning;
	const color = healthColor(stats.healthPct);

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:py-2 ep:rounded ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				activeDue === 0 && "ep:opacity-40",
			)}
			onClick={onReview}
		>
			<span
				class="ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0"
				style={{ backgroundColor: color }}
			/>

			<span class="ep:flex-1 ep:text-sm ep:text-obs-normal ep:truncate ep:min-w-0">
				{stats.name}
			</span>

			<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums">
				{stats.healthPct}%
			</span>

			<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums ep:min-w-[4ch] ep:text-right">
				{activeDue > 0 ? `${activeDue} due` : "---"}
			</span>
		</Clickable>
	);
}
