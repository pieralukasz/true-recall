import { useMemo } from "preact/hooks";
import { prioritySortComparator } from "../helpers/note-priority";
import { useVirtualList } from "../helpers/use-virtual-list";
import type { DashboardNoteEntry } from "../types";
import { NoteRow } from "./NoteRow";

interface UnassignedTabProps {
	notes: DashboardNoteEntry[];
	searchQuery: string;
	onNavigateToNote: (noteName: string) => void;
	onStudyNote: (noteName: string) => void;
	onCustomStudyNote: (noteName: string) => void;
}

export function UnassignedTab({
	notes,
	searchQuery,
	onNavigateToNote,
	onStudyNote,
	onCustomStudyNote,
}: UnassignedTabProps) {
	const filteredNotes = useMemo(() => {
		let result = notes;
		if (searchQuery) {
			result = result.filter((n) =>
				n.name.toLowerCase().includes(searchQuery),
			);
		}
		return [...result].sort(prioritySortComparator);
	}, [notes, searchQuery]);

	const { containerRef, totalHeight, virtualItems, onScroll } =
		useVirtualList(filteredNotes);

	if (filteredNotes.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
				{notes.length === 0
					? "All notes are assigned to projects."
					: "No matching notes."}
			</div>
		);
	}

	return (
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
				{virtualItems.map(({ item, offsetTop }) => (
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
							onNavigate={() => onNavigateToNote(item.name)}
							onStudy={() => onStudyNote(item.name)}
							onCustomStudy={() => onCustomStudyNote(item.name)}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
