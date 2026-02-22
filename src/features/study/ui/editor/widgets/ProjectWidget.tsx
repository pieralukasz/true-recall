import { effect } from "@preact/signals";
import { dataVersion, track } from "@shared/services/signals";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { usePlugin } from "@shared/ui/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { computeProjectStats, type ProjectStats } from "./project-stats";

export function ProjectWidget({
	sourcePath,
}: {
	source: string;
	sourcePath: string;
}) {
	const plugin = usePlugin();
	const [ver, setVer] = useState(0);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion);
			setVer((v) => v + 1);
		});
		return dispose;
	}, []);

	const isProject = useMemo(() => {
		void ver;
		const values = plugin.frontmatterIndex.getValues("project", sourcePath);
		return values.includes("true");
	}, [plugin, sourcePath, ver]);

	const stats = useMemo((): ProjectStats | null => {
		void ver;
		if (!isProject || !plugin.cardStore) return null;

		const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
		const name = file?.name?.replace(/\.md$/, "") ?? sourcePath;
		const childCount = plugin.projectLinkService.getChildProjects(sourcePath).length;

		return computeProjectStats(
			sourcePath,
			name,
			childCount,
			plugin.projectLinkService,
			plugin.cardStore,
			plugin.fsrsService,
		);
	}, [plugin, sourcePath, isProject, ver]);

	if (!isProject) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				Add <code>project: true</code> to this note's frontmatter to use as a
				project dashboard.
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
				const members = plugin.projectLinkService.getMemberPaths(sourcePath);
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
					<button
						class="ep:text-sm ep:font-semibold ep:text-obs-normal ep:cursor-pointer ep:hover:underline ep:bg-transparent ep:border-none ep:p-0 ep:text-left"
						onClick={onClickName}
					>
						{stats.name}
					</button>
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
					<button
						class="ep:text-xs ep:px-2.5 ep:py-1 ep:rounded ep:bg-obs-interactive-accent ep:text-obs-on-accent ep:cursor-pointer ep:border-none ep:hover:opacity-90"
						onClick={onReview}
					>
						Review &rarr;
					</button>
					<button
						class="ep:text-xs ep:px-2.5 ep:py-1 ep:rounded ep:border ep:border-obs-modifier-border ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:hover:text-obs-normal"
						onClick={onCustomStudy}
					>
						Custom study &rarr;
					</button>
				</div>
			)}
		</div>
	);
}

function healthColor(pct: number): string {
	if (pct >= 80) return `var(${FSRS_COLORS.new.cssVar})`;
	if (pct >= 50) return `var(${FSRS_COLORS.learning.cssVar})`;
	return `var(${FSRS_COLORS.suspended.cssVar})`;
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
