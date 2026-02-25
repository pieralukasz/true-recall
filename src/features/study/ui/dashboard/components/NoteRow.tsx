import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { cn } from "@shared/ui/utils";
import type { DashboardNoteEntry } from "../types";

interface NoteRowProps {
	note: DashboardNoteEntry;
	onNavigate: () => void;
	onStudy: () => void;
	onCustomStudy: () => void;
}

export function NoteRow({
	note,
	onNavigate,
	onStudy,
	onCustomStudy,
}: NoteRowProps) {
	const hasActive = note.due + note.newCount + note.learning > 0;

	return (
		<div
			class={cn(
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:py-1 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				!hasActive && "ep:opacity-40",
			)}
		>
			<Clickable
				class="ep:flex-1 ep:min-w-0 ep:hover:text-obs-interactive ep:transition-colors"
				onClick={onNavigate}
			>
				<div
					class="ep:text-sm ep:text-obs-normal ep:truncate"
					title={note.name}
				>
					{note.name}
				</div>
			</Clickable>

			<CardCountDisplay
				newCount={note.newCount}
				learningCount={note.learning}
				dueCount={note.due}
			/>

			<div class="ep:flex ep:items-center ep:gap-0.5">
				<IconButton
					icon="play"
					ariaLabel={`Study ${note.name}`}
					onClick={onStudy}
					size="small"
				/>
				<IconButton
					icon="settings"
					ariaLabel={`Custom study ${note.name}`}
					onClick={onCustomStudy}
					size="small"
				/>
			</div>
		</div>
	);
}
