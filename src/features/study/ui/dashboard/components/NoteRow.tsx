import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { cn } from "@shared/ui/utils";
import type { DashboardNoteEntry } from "../types";

interface NoteRowProps {
	note: DashboardNoteEntry;
	onClick: () => void;
}

export function NoteRow({ note, onClick }: NoteRowProps) {
	const hasActive = note.due + note.newCount + note.learning > 0;

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:py-1 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				!hasActive && "ep:opacity-40",
			)}
			onClick={onClick}
		>
			<div class="ep:flex-1 ep:min-w-0">
				<div
					class="ep:text-sm ep:text-obs-normal ep:truncate"
					title={note.name}
				>
					{note.name}
				</div>
			</div>

			<CardCountDisplay
				newCount={note.newCount}
				learningCount={note.learning}
				dueCount={note.due}
			/>
		</Clickable>
	);
}
