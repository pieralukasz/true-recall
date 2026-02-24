import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { usePlugin } from "@shared/ui/preact";
import { prioritySortComparator } from "../helpers/note-priority";
import type { DashboardNoteEntry, NoteFilterMode } from "../types";
import { NoteFilters } from "./NoteFilters";
import { NoteRow } from "./NoteRow";

interface NoteListProps {
	notes: DashboardNoteEntry[];
}

function matchesFilter(
	note: DashboardNoteEntry,
	filter: NoteFilterMode,
): boolean {
	switch (filter) {
		case "all":
			return true;
		case "due":
			return note.due > 0;
		case "new":
			return note.newCount > 0;
		case "learning":
			return note.learning > 0;
		case "overdue":
			return note.overdueCount > 0;
	}
}

export function NoteList({ notes }: NoteListProps) {
	const plugin = usePlugin();
	const searchQuery = useSignal("");
	const activeFilter = useSignal<NoteFilterMode>("all");

	const counts = useMemo((): Record<NoteFilterMode, number> => {
		return {
			all: notes.length,
			due: notes.filter((n) => n.due > 0).length,
			new: notes.filter((n) => n.newCount > 0).length,
			learning: notes.filter((n) => n.learning > 0).length,
			overdue: notes.filter((n) => n.overdueCount > 0).length,
		};
	}, [notes]);

	const filteredNotes = useMemo(() => {
		let result = notes;

		if (activeFilter.value !== "all") {
			result = result.filter((n) =>
				matchesFilter(n, activeFilter.value),
			);
		}

		if (searchQuery.value) {
			const q = searchQuery.value.toLowerCase();
			result = result.filter((n) => n.name.toLowerCase().includes(q));
		}

		return [...result].sort(prioritySortComparator);
	}, [notes, searchQuery.value, activeFilter.value]);

	const handleStudyNote = (noteName: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
			ignoreDailyLimits: true,
		});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<NoteFilters
				searchQuery={searchQuery.value}
				onSearchChange={(q) => {
					searchQuery.value = q;
				}}
				activeFilter={activeFilter.value}
				onFilterChange={(f) => {
					activeFilter.value = f;
				}}
				counts={counts}
			/>

			{filteredNotes.length === 0 ? (
				<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
					{notes.length === 0
						? "No notes with flashcards yet."
						: "No matching notes."}
				</div>
			) : (
				<div class="ep:flex ep:flex-col">
					{filteredNotes.map((note) => (
						<NoteRow
							key={note.name}
							note={note}
							onPlay={() => handleStudyNote(note.name)}
							onClick={() => handleStudyNote(note.name)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
