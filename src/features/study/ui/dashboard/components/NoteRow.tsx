import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { FSRS_COLORS, MUTED_STATES } from "@shared/ui/helpers/fsrs-colors";
import { formatEstimatedTime } from "../helpers/time-estimate";
import type { DashboardNoteEntry, NotePriority } from "../types";

interface NoteRowProps {
	note: DashboardNoteEntry;
	onPlay: () => void;
	onClick: () => void;
}

const PRIORITY_CONFIG: Record<
	NotePriority,
	{ label: string; cls: string } | null
> = {
	overdue: {
		label: "Overdue",
		cls: `${FSRS_COLORS.suspended.badgeCls} ep:text-[10px]`,
	},
	hot: {
		label: "Hot",
		cls: `${FSRS_COLORS.learning.badgeCls} ep:text-[10px]`,
	},
	due: { label: "Due", cls: `${FSRS_COLORS.review.badgeCls} ep:text-[10px]` },
	light: {
		label: "Light",
		cls: `${FSRS_COLORS.new.badgeCls} ep:text-[10px]`,
	},
	done: {
		label: "Done",
		cls: `${MUTED_STATES.unknown.badgeCls} ep:text-[10px]`,
	},
};

export function NoteRow({ note, onPlay, onClick }: NoteRowProps) {
	const hasActive = note.due + note.newCount + note.learning > 0;
	const priorityCfg = PRIORITY_CONFIG[note.priority];

	return (
		<Clickable
			class={[
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:py-2.5 ep:rounded-lg ep:transition-all ep:duration-150 ep:hover:bg-obs-modifier-hover",
				hasActive ? "" : "ep:opacity-40",
			].join(" ")}
			onClick={onClick}
		>
			{/* Play button */}
			<IconButton
				icon="play"
				ariaLabel={`Study ${note.name}`}
				onClick={(e) => {
					e.stopPropagation();
					onPlay();
				}}
				size="small"
				class="ep:shrink-0"
			/>

			{/* Note name + path */}
			<div class="ep:flex-1 ep:min-w-0">
				<div
					class="ep:text-sm ep:font-medium ep:text-obs-normal ep:line-clamp-2"
					title={note.name}
				>
					{note.name}
				</div>
			</div>

			{/* Right side: priority tag + time + card counts */}
			<div class="ep:flex ep:flex-col ep:items-end ep:gap-0.5 ep:shrink-0">
				<div class="ep:flex ep:items-center ep:gap-2">
					{priorityCfg && hasActive && (
						<span
							class={`ep:px-1.5 ep:py-0.5 ep:rounded ep:font-medium ${priorityCfg.cls}`}
						>
							{priorityCfg.label}
						</span>
					)}
					{note.estimatedMinutes > 0 && hasActive && (
						<span class="ep:text-ui-smaller ep:text-obs-faint">
							~{formatEstimatedTime(note.estimatedMinutes)}
						</span>
					)}
				</div>
				<CardCountDisplay
					newCount={note.newCount}
					learningCount={note.learning}
					dueCount={note.due}
				/>
			</div>
		</Clickable>
	);
}
