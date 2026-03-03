import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { useContextMenu } from "@shared/ui/preact/useContextMenu";
import { cn } from "@shared/ui/utils";
import type { DashboardNoteEntry, NotePriority } from "../types";

const PRIORITY_DOT: Record<NotePriority, string> = {
	overdue: "ep:bg-obs-red",
	hot: "ep:bg-obs-orange",
	due: "ep:bg-obs-blue",
	light: "ep:bg-obs-green",
	done: "ep:bg-obs-faint",
};

interface NoteRowProps {
	note: DashboardNoteEntry;
	onNavigate: () => void;
	onStudy: () => void;
	onCustomStudy: () => void;
	onProjectClick?: (projectName: string) => void;
	onPresetClick?: (notePath: string | null) => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
}

export function NoteRow({
	note,
	onNavigate,
	onStudy,
	onCustomStudy,
	onProjectClick,
	onPresetClick,
	onArchive,
	onUnarchive,
}: NoteRowProps) {
	const hasActive = note.due + note.newCount + note.learning > 0;

	const handleContextMenu = useContextMenu([
		{ title: "Study", icon: "play", onClick: onStudy },
		{ title: "Custom session", icon: "sliders-horizontal", onClick: onCustomStudy },
		{ title: "Go to note", icon: "file-text", onClick: onNavigate },
		note.archived
			? { title: "Unarchive", icon: "archive-restore", onClick: () => onUnarchive?.() }
			: { title: "Archive", icon: "archive", onClick: () => onArchive?.() },
	]);

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:h-9 ep:overflow-hidden ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				!hasActive && "ep:opacity-40",
			)}
			onContextMenu={handleContextMenu}
			onClick={onNavigate}
			stopPropagation={false}
		>
			<div class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0 ep:hover:text-obs-interactive ep:transition-colors">
				<span
					class={cn(
						"ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0",
						PRIORITY_DOT[note.priority],
					)}
				/>
				<span
					class="ep:text-sm ep:text-obs-normal ep:truncate"
					title={note.name}
				>
					{note.name}
				</span>
				{note.presetName && (
					<Clickable
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:shrink-0"
						title={`FSRS preset: ${note.presetName}`}
						onClick={() => onPresetClick?.(note.path)}
					>
						{note.presetName}
					</Clickable>
				)}
			</div>

			{note.projects.length > 0 && (
				<div
					class="ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:max-w-[200px] ep:overflow-hidden"
					title={note.projects.join(", ")}
				>
					{note.projects.slice(0, 2).map((projectName) => (
						<Clickable
							key={projectName}
							class="ep:px-1.5 ep:py-0.5 ep:text-[10px] ep:leading-tight ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:truncate ep:max-w-[90px] ep:shrink-0"
							onClick={() => onProjectClick?.(projectName)}
						>
							{projectName}
						</Clickable>
					))}
					{note.projects.length > 2 && (
						<span class="ep:text-[10px] ep:text-obs-faint ep:shrink-0">
							+{note.projects.length - 2}
						</span>
					)}
				</div>
			)}

			<CardCountDisplay
				newCount={note.newCount}
				learningCount={note.learning}
				dueCount={note.due}
			/>

			<div class="ep:flex ep:items-center">
				<IconButton
					icon="play"
					ariaLabel={`Study ${note.name}`}
					onClick={onStudy}
					size="small"
				/>
			</div>
		</Clickable>
	);
}
