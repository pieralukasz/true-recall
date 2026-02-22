import {
	buildProjectGraph,
	getDescendantProjects,
	isProjectNote,
} from "@shared/utils/project-hierarchy";
import { effect } from "@preact/signals";
import { dataVersion, track } from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { State } from "ts-fsrs";
import { useEffect, useMemo, useState } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "./config-parser";

interface ProjectData {
	projectName: string;
	noteCount: number;
	totalCards: number;
	totalDue: number;
	totalNew: number;
	totalLearning: number;
	healthPct: number | null;
}

export function ProjectWidget({
	source,
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

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useMemo((): ProjectData | "not-project" | null => {
		void ver;
		if (!plugin.cardStore || !plugin.frontmatterIndex) return null;

		const basename = sourcePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
		const projects = plugin.frontmatterIndex.getValues("projects", sourcePath);

		if (!isProjectNote(basename, projects)) {
			return "not-project";
		}

		const projectName = basename;
		const includeChildren = configValue(config, "includeChildren", true);
		const showHealth = configValue(config, "showHealth", true);

		// Collect all project names to include (self + descendants)
		const projectNames = new Set<string>([projectName]);
		if (includeChildren) {
			const graph = buildProjectGraph(plugin.frontmatterIndex);
			const descendants = getDescendantProjects(projectName, graph.childrenMap);
			for (const d of descendants) {
				projectNames.add(d);
			}
		}

		// Gather all member notes and aggregate card counts
		const now = new Date();
		const visitedPaths = new Set<string>();
		const sourceUids: string[] = [];
		let totalCards = 0;
		let totalDue = 0;
		let totalNew = 0;
		let totalLearning = 0;

		for (const pName of projectNames) {
			const files = plugin.frontmatterIndex.getFilesByValue("projects", pName);
			for (const file of files) {
				if (visitedPaths.has(file.path)) continue;
				visitedPaths.add(file.path);

				// Skip project notes themselves
				const fileProjects = plugin.frontmatterIndex.getValues("projects", file.path);
				if (isProjectNote(file.basename, fileProjects) && file.basename !== projectName) {
					continue;
				}
				if (file.basename === projectName && file.path === sourcePath) {
					continue;
				}

				const uids = plugin.frontmatterIndex.getValues("flashcard_uid", file.path);
				const uid = uids[0];
				if (!uid) continue;

				const cards = plugin.cardStore.getCardsBySourceUid(uid);
				if (cards.length === 0) continue;

				sourceUids.push(uid);

				for (const c of cards) {
					if (c.suspended) continue;
					if (c.buriedUntil && new Date(c.buriedUntil) > now) continue;

					totalCards++;
					switch (c.state) {
						case State.New:
							totalNew++;
							break;
						case State.Learning:
						case State.Relearning:
							totalLearning++;
							break;
						case State.Review:
							if (new Date(c.due) <= now) {
								totalDue++;
							}
							break;
					}
				}
			}
		}

		// Compute health as average retrievability across all active review cards
		let healthPct: number | null = null;
		if (showHealth && totalCards > 0) {
			let rSum = 0;
			let rCount = 0;
			for (const uid of sourceUids) {
				const cards = plugin.cardStore.getCardsBySourceUid(uid);
				for (const c of cards) {
					if (c.suspended) continue;
					if (c.state === State.New) continue;
					const r = plugin.fsrsService.getRetrievability(c, now);
					if (r > 0) {
						rSum += r;
						rCount++;
					}
				}
			}
			if (rCount > 0) {
				healthPct = Math.round((rSum / rCount) * 100);
			}
		}

		return {
			projectName,
			noteCount: sourceUids.length,
			totalCards,
			totalDue,
			totalNew,
			totalLearning,
			healthPct,
		};
	}, [plugin, ver, config, sourcePath]);

	if (data === null) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	if (data === "not-project") {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				This note is not a project. Add <code>projects: ["[[NoteName]]"]</code> to its frontmatter.
			</div>
		);
	}

	const handleReviewProject = () => {
		plugin.openReviewViewWithFilters({
			projectFilters: [data.projectName],
			ignoreDailyLimits: true,
		}).catch(() => {});
	};

	const handleCustomStudy = () => {
		plugin.openCustomStudyModal({
			projectFilters: [data.projectName],
			scopeLabel: data.projectName,
		}).catch(() => {});
	};

	if (data.totalCards === 0) {
		return (
			<div class="ep:flex ep:flex-col ep:gap-1 ep:p-3 ep:text-sm">
				<span class="ep:font-semibold">{data.projectName}</span>
				<span class="ep:text-obs-muted ep:text-xs">No flashcards in this project yet.</span>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm">
			{/* Header */}
			<div class="ep:flex ep:flex-col ep:gap-0.5">
				<div class="ep:flex ep:items-center ep:justify-between">
					<span class="ep:font-semibold">{data.projectName}</span>
					<span class="ep:text-xs ep:text-obs-muted">
						{data.noteCount} {data.noteCount === 1 ? "note" : "notes"} · {data.totalCards} cards
					</span>
				</div>
				<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
					<span class="ep:flex ep:gap-2">
						{data.totalDue > 0 && (
							<span style={{ color: "var(--color-blue)" }}>{data.totalDue} due</span>
						)}
						{data.totalNew > 0 && (
							<span style={{ color: "var(--color-green)" }}>{data.totalNew} new</span>
						)}
						{data.totalLearning > 0 && (
							<span style={{ color: "var(--color-orange)" }}>{data.totalLearning} lrn</span>
						)}
						{data.totalDue === 0 && data.totalNew === 0 && data.totalLearning === 0 && (
							<span class="ep:text-obs-muted">All caught up</span>
						)}
					</span>
					{data.healthPct != null && (
						<span
							class="ep:font-semibold"
							style={{
								color:
									data.healthPct >= 85
										? "var(--color-green)"
										: data.healthPct >= 70
											? "var(--color-cyan)"
											: data.healthPct >= 50
												? "var(--color-orange)"
												: "var(--color-red)",
							}}
						>
							Health: {data.healthPct}%
						</span>
					)}
				</div>
			</div>

			{/* Action buttons */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs">
				<button
					class="ep:px-2 ep:py-0.5 ep:rounded ep:bg-obs-interactive-accent ep:text-obs-on-accent ep:cursor-pointer hover:ep:opacity-90"
					onClick={handleReviewProject}
				>
					Review project →
				</button>
				<button
					class="ep:px-2 ep:py-0.5 ep:rounded ep:border ep:border-obs-modifier-border ep:cursor-pointer hover:ep:bg-obs-modifier-hover"
					onClick={handleCustomStudy}
				>
					Custom study →
				</button>
			</div>
		</div>
	);
}
