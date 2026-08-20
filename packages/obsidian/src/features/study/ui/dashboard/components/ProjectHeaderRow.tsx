import { useState } from "preact/hooks";

import {
	computePriority,
	PRIORITY_DOT,
} from "@true-recall/core/helpers/note-priority";

import {
	CardCountDisplay,
	Clickable,
	IconButton,
	InlineCardCount,
	PlayIcon,
	RetentionDisplay,
} from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { cn } from "@true-recall/obsidian/utils/cn";

import type { DashboardProject } from "../types";
import { RetrievabilityBar } from "./RetrievabilityBar";

interface ProjectHeaderRowProps {
	project: DashboardProject;
	depth: number;
	isExpanded: boolean;
	isVirtual?: boolean;
	onToggle: () => void;
	/** cardCount is set only in R-Mode, where the user states the session size. */
	onStudyProject: (cardCount?: number) => void;
	onCustomStudy?: () => void;
	onNavigate?: () => void;
	onPresetClick?: (path: string | null) => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onRename?: () => void;
	onContextMenu?: (e: MouseEvent) => void;
}

export function ProjectHeaderRow({
	project,
	depth,
	isExpanded: _isExpanded,
	isVirtual,
	onToggle,
	onStudyProject,
	onContextMenu,
}: ProjectHeaderRowProps) {
	const plugin = usePlugin();
	const rModeEnabled = plugin.settings.rMode.enabled;
	const [size, setSize] = useState(
		String(plugin.settings.rMode.defaultSessionSize),
	);

	const parsed = Number.parseInt(size, 10);
	// An empty field states nothing and lets the default apply; a typed 0 is a
	// real request for a session of new and learning cards only.
	const requestedReviews = Number.isNaN(parsed)
		? undefined
		: Math.max(0, parsed);
	const wantsReviews = requestedReviews === undefined || requestedReviews > 0;

	// New and learning cards are outside R-Mode's selection, so a session is
	// still worth starting when only they are available. Dimming the action
	// says "nothing here" without adding another number to the row.
	const hasWork = rModeEnabled
		? (wantsReviews && (project.retrievability?.pool ?? 0) > 0) ||
			project.newCount > 0 ||
			project.learning > 0
		: project.due > 0 || project.newCount > 0 || project.learning > 0;

	const startSession = () => {
		if (!hasWork) return;
		onStudyProject(rModeEnabled ? requestedReviews : undefined);
	};

	const priority = computePriority({
		overdueCount: 0,
		due: project.due,
		learning: project.learning,
		newCount: project.newCount,
		retrievability: project.retrievability,
	});

	return (
		<div
			role="group"
			class={cn(
				"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:h-9 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				project.archived && "ep:opacity-50",
				// Nothing waiting reads faster as a dim row than as another zero.
				!hasWork && !project.archived && "ep:opacity-45",
			)}
			style={{ paddingLeft: `${12 + depth * 20}px` }}
			onContextMenu={onContextMenu}
		>
			<Clickable
				class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0 ep:h-full"
				onClick={onToggle}
				stopPropagation={false}
			>
				<span
					class={cn(
						"ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0",
						PRIORITY_DOT[priority],
					)}
				/>
				<span
					class={cn(
						"ep:text-sm ep:truncate ep:min-w-0 ep:font-medium",
						isVirtual ? "ep:text-obs-muted ep:italic" : "ep:text-obs-normal",
						project.archived && "tr-faux-strike",
					)}
				>
					{project.name}
				</span>

				{project.presetName && (
					<span
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:shrink-0"
						title={`FSRS preset: ${project.presetName}`}
					>
						{project.presetName}
					</span>
				)}

				<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums">
					{project.totalMembers}
					{project.totalMembers === 1 ? " note" : " notes"}
				</span>
			</Clickable>

			{rModeEnabled && <RetrievabilityBar spread={project.retrievability} />}

			{rModeEnabled ? (
				<RetentionDisplay
					newCount={project.newCount}
					learningCount={project.learning}
					learningPending={project.learningPending}
				/>
			) : (
				<CardCountDisplay
					newCount={project.newCount}
					learningCount={project.learning}
					dueCount={project.due}
				/>
			)}

			{rModeEnabled && (
				<InlineCardCount
					value={size}
					onChange={setSize}
					onSubmit={startSession}
					ariaLabel={`Review cards from ${project.name}`}
					available={project.retrievability?.pool ?? 0}
				/>
			)}

			<IconButton
				icon="play"
				customIcon={<PlayIcon />}
				disabled={!hasWork}
				ariaLabel={`Study ${project.name}`}
				onClick={startSession}
				size="small"
			/>
		</div>
	);
}

export function EmptyProjectRow({ depth }: { depth: number }) {
	return (
		<div
			class="ep:text-xs ep:text-obs-muted ep:px-3 ep:flex ep:items-center ep:h-9"
			style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}
		>
			No member notes
		</div>
	);
}
