import { CardCountDisplay } from "@shared/ui/components";
import type { NoteStats, SessionLogic } from "@features/study/ui/session/SessionLogic";

interface NoteListProps {
	logic: SessionLogic;
	searchQuery: string;
	now: Date;
	selectedNotes: Set<string>;
	onToggle: (name: string) => void;
	onNavigate: (path: string) => void;
}

export function NoteList({
	logic,
	searchQuery,
	now,
	selectedNotes,
	onToggle,
	onNavigate,
}: NoteListProps) {
	const filteredStats = logic.getFilteredNoteStats(searchQuery, now);

	if (filteredStats.length === 0) {
		return (
			<div class="ep:text-center ep:py-8 ep:text-obs-muted ep:text-ui-small">
				{searchQuery
					? "No notes match your search"
					: "No notes with flashcards found"}
			</div>
		);
	}

	return (
		<div class="true-recall-note-list">
			{filteredStats.map((stat) => (
				<NoteRow
					key={stat.noteName}
					stat={stat}
					isSelected={selectedNotes.has(stat.noteName)}
					onToggle={() => onToggle(stat.noteName)}
					onNavigate={
						stat.notePath
							? () => onNavigate(stat.notePath as string)
							: undefined
					}
				/>
			))}
		</div>
	);
}

function NoteRow({
	stat,
	isSelected,
	onToggle,
	onNavigate,
}: {
	stat: NoteStats;
	isSelected: boolean;
	onToggle: () => void;
	onNavigate?: () => void;
}) {
	const hasCards = stat.newCount > 0 || stat.dueCount > 0;

	return (
		<button
			type="button"
			class={`ep:flex ep:items-center ep:gap-3 ep:py-2.5 ep:px-3 ep:border-b ep:border-obs-modifier-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:bg-transparent ep:border-x-0 ep:border-t-0 ep:font-inherit ep:text-left ep:w-full${isSelected ? " ep:bg-obs-interactive/10" : ""}`}
			onClick={(e) => {
				const target = e.target as HTMLElement;
				if (target.tagName !== "INPUT" && target.tagName !== "A" && hasCards)
					onToggle();
			}}
		>
			{hasCards ? (
				<input
					type="checkbox"
					class="ep:shrink-0 ep:w-4 ep:h-4"
					checked={isSelected}
					onChange={onToggle}
				/>
			) : stat.isCompleted ? (
				<span class="ep:text-obs-green ep:text-ui-medium ep:font-semibold ep:w-4 ep:text-center">
					{"\u2713"}
				</span>
			) : null}

			<div class="ep:flex-1 ep:min-w-0">
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:line-clamp-2">
					{onNavigate ? (
						<button
							type="button"
							class="ep:text-obs-normal ep:no-underline ep:hover:text-obs-link ep:hover:underline ep:bg-transparent ep:border-none ep:p-0 ep:cursor-pointer ep:text-left ep:font-inherit"
							onClick={(e) => {
								e.stopPropagation();
								onNavigate();
							}}
						>
							{stat.noteName}
						</button>
					) : (
						stat.noteName
					)}
				</div>
				<div class="ep:text-ui-smaller ep:mt-0.5 ep:flex ep:items-center ep:gap-1">
					{hasCards ? (
						<CardCountDisplay
							newCount={stat.newCount}
							learningCount={0}
							dueCount={stat.dueCount}
							variant="compact"
							size="smaller"
							bold
						/>
					) : (
						<span class="ep:text-obs-faint">done</span>
					)}
				</div>
			</div>
		</button>
	);
}
