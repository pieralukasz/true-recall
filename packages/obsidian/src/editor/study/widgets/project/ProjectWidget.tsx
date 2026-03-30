import { useComputed } from "@preact/signals";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import {
	computeProjectStats,
	healthColor,
	type ProjectStats,
} from "../project-stats";
import { WidgetCta } from "../WidgetCta";

export function ProjectWidget({
	sourcePath,
}: {
	source: string;
	sourcePath: string;
}) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const archivedUids = useQuery<ReadonlySet<string>>(Q.ARCHIVED_UIDS);

	// A note is a "project" if any note declares it as a parent
	const isProject = useComputed(() => {
		void allMeta.value;
		void archivedUids.value;
		const children = plugin.hierarchyService.getChildPaths(sourcePath);
		return children.length > 0;
	}).value;

	const stats = useComputed((): ProjectStats | null => {
		void allMeta.value;
		const archived = archivedUids.value;
		if (!isProject || !plugin.cardStore) return null;

		const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
		const name = file?.name?.replace(/\.md$/, "") ?? sourcePath;
		// Count sub-projects (children that themselves have children)
		const childPaths = plugin.hierarchyService.getChildPaths(sourcePath);
		const childCount = childPaths.filter(
			(cp) => plugin.hierarchyService.getChildPaths(cp).length > 0,
		).length;

		const allSourceUids =
			plugin.hierarchyService.getSourceUidsForProject(sourcePath);
		const filteredUids = new Set(
			[...allSourceUids].filter((uid) => !archived.has(uid)),
		);

		return computeProjectStats(
			sourcePath,
			name,
			childCount,
			plugin.hierarchyService,
			plugin.cardStore,
			plugin.fsrsService,
			{ sourceUids: filteredUids },
		);
	}).value;

	if (!isProject) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No child notes found. Add <code>parents: ["[[this note]]"]</code> to
				other notes to use this as a project.
			</div>
		);
	}

	if (!stats) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	return (
		<ProjectCard
			stats={stats}
			onReview={() => {
				plugin
					.openReviewViewWithFilters({
						projectPath: sourcePath,
						ignoreDailyLimits: true,
					})
					.catch(() => {});
			}}
			onCustomStudy={() => {
				const members = plugin.hierarchyService.getChildPaths(sourcePath);
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
	);
}

export function ProjectCard({
	stats,
	onReview,
	onCustomStudy,
	onClickName,
	depth = 0,
}: {
	stats: ProjectStats;
	onReview: () => void;
	onCustomStudy: () => void;
	onClickName?: () => void;
	depth?: number;
}) {
	const activeDue = stats.due + stats.newCount + stats.learning;

	return (
		<div
			class="ep:rounded-lg ep:border ep:border-obs-modifier-border ep:p-3 ep:flex ep:flex-col ep:gap-2"
			style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}
		>
			{/* Header: name + health bar */}
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
				{onClickName ? (
					<Clickable
						class="ep:text-sm ep:font-semibold ep:text-obs-normal ep:hover:underline"
						onClick={onClickName}
					>
						{stats.name}
					</Clickable>
				) : (
					<span class="ep:text-sm ep:font-semibold">{stats.name}</span>
				)}
				<div class="ep:flex ep:items-center ep:gap-1.5 ep:text-xs ep:shrink-0">
					<span class="ep:text-obs-muted">{stats.healthPct}%</span>
					<div class="ep:w-16 ep:h-2 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden">
						<div
							class="ep:h-full ep:rounded-full ep:transition-all"
							style={{
								width: `${stats.healthPct}%`,
								backgroundColor: healthColor(stats.healthPct),
							}}
						/>
					</div>
				</div>
			</div>

			{/* FSRS state counts */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:flex-wrap">
				<span style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
					{stats.newCount} new
				</span>
				<span style={{ opacity: 0.4 }}>&middot;</span>
				<span style={{ color: `var(${FSRS_COLORS.learning.cssVar})` }}>
					{stats.learning} learning
				</span>
				<span style={{ opacity: 0.4 }}>&middot;</span>
				<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
					{stats.due} due
				</span>
			</div>

			{/* Meta row */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:text-obs-muted ep:flex-wrap">
				<span>{stats.totalCards} cards</span>
				{stats.childCount > 0 && (
					<>
						<span style={{ opacity: 0.4 }}>&middot;</span>
						<span>{stats.childCount} sub-projects</span>
					</>
				)}
				{stats.lastReviewed && (
					<>
						<span style={{ opacity: 0.4 }}>&middot;</span>
						<span>Last: {formatTimeAgo(stats.lastReviewed)}</span>
					</>
				)}
			</div>

			{/* Action buttons */}
			{activeDue > 0 && (
				<div class="ep:flex ep:items-center ep:gap-2 ep:pt-1">
					<WidgetCta label="Review →" onClick={onReview} />
					<WidgetCta
						label="Custom study →"
						onClick={onCustomStudy}
						variant="secondary"
					/>
				</div>
			)}
		</div>
	);
}

function formatTimeAgo(isoDate: string): string {
	const diff = Date.now() - new Date(isoDate).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
