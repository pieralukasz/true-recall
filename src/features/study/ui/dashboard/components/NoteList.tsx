import { useSignal } from "@preact/signals";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { prioritySortComparator } from "../helpers/note-priority";
import { useVirtualList } from "../helpers/use-virtual-list";
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
			result = result.filter((n) => matchesFilter(n, activeFilter.value));
		}

		if (searchQuery.value) {
			const q = searchQuery.value.toLowerCase();
			result = result.filter((n) => n.name.toLowerCase().includes(q));
		}

		return [...result].sort(prioritySortComparator);
	}, [notes, searchQuery.value, activeFilter.value]);

	const { containerRef, totalHeight, virtualItems, onScroll } =
		useVirtualList(filteredNotes);

	const handleNavigateToNote = (note: DashboardNoteEntry) => {
		void plugin.app.workspace.openLinkText(note.name, "");
	};

	const handleStudyNote = (noteName: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
			ignoreDailyLimits: true,
		});
	};

	const handleCustomStudy = (note: DashboardNoteEntry) => {
		void plugin.openCustomStudyModal({
			sourceNoteFilters: [note.name],
			scopeLabel: note.name,
		});
	};

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0">
			<div class="ep:shrink-0 ep:mb-3">
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
			</div>

			{filteredNotes.length === 0 ? (
				<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
					{notes.length === 0
						? "No notes with flashcards yet."
						: "No matching notes."}
				</div>
			) : (
				<div
					ref={containerRef}
					class="ep:flex-1 ep:overflow-y-auto ep:min-h-0"
					onScroll={onScroll}
				>
					<div
						style={{
							height: `${totalHeight}px`,
							position: "relative",
						}}
					>
						{virtualItems.map(({ item, index, offsetTop }) => (
							<div
								key={item.name}
								style={{
									position: "absolute",
									top: `${offsetTop}px`,
									left: 0,
									right: 0,
									height: "36px",
								}}
							>
								<NoteRow
									note={item}
									onNavigate={() => handleNavigateToNote(item)}
									onStudy={() => handleStudyNote(item.name)}
									onCustomStudy={() => handleCustomStudy(item)}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
