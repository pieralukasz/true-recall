import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import { cn } from "@shared/ui/utils";
import { useMemo } from "preact/hooks";
import { prioritySortComparator } from "../helpers/note-priority";
import { useVirtualList } from "../helpers/use-virtual-list";
import type {
	DashboardNoteEntry,
	NoteFilterMode,
	ProjectFilter,
} from "../types";
import { NoteFilters } from "./NoteFilters";
import { NoteRow } from "./NoteRow";

interface NoteListProps {
	notes: DashboardNoteEntry[];
	searchQuery: string;
	allProjectNames: string[];
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

export function NoteList({ notes, searchQuery, allProjectNames }: NoteListProps) {
	const plugin = usePlugin();
	const activeFilter = useSignal<NoteFilterMode>("all");
	const projectFilter = useSignal<ProjectFilter>({ type: "none" });

	const unassignedCount = useMemo(
		() => notes.filter((n) => n.projects.length === 0).length,
		[notes],
	);

	// First pass: apply project filter
	const projectFiltered = useMemo(() => {
		const pf = projectFilter.value;
		if (pf.type === "project")
			return notes.filter((n) => n.projects.includes(pf.name));
		if (pf.type === "unassigned")
			return notes.filter((n) => n.projects.length === 0);
		return notes;
	}, [notes, projectFilter.value]);

	// State filter counts reflect the project-filtered subset
	const counts = useMemo((): Record<NoteFilterMode, number> => {
		return {
			all: projectFiltered.length,
			due: projectFiltered.filter((n) => n.due > 0).length,
			new: projectFiltered.filter((n) => n.newCount > 0).length,
			learning: projectFiltered.filter((n) => n.learning > 0).length,
			overdue: projectFiltered.filter((n) => n.overdueCount > 0).length,
		};
	}, [projectFiltered]);

	const filteredNotes = useMemo(() => {
		let result = projectFiltered;

		if (activeFilter.value !== "all") {
			result = result.filter((n) => matchesFilter(n, activeFilter.value));
		}

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter((n) => n.name.toLowerCase().includes(q));
		}

		return [...result].sort(prioritySortComparator);
	}, [projectFiltered, searchQuery, activeFilter.value]);

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

	const handleProjectClick = (projectName: string) => {
		projectFilter.value = { type: "project", name: projectName };
	};

	const pf = projectFilter.value;

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0">
			{/* Project filter area */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:mb-2 ep:flex-wrap ep:shrink-0">
				<Clickable
					class={cn(
						"ep:px-2 ep:py-0.5 ep:rounded-full ep:text-ui-smaller ep:transition-colors",
						pf.type === "unassigned"
							? "ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-medium"
							: "ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal",
					)}
					onClick={() => {
						projectFilter.value =
							pf.type === "unassigned"
								? { type: "none" }
								: { type: "unassigned" };
					}}
				>
					Unassigned ({unassignedCount})
				</Clickable>

				{pf.type === "project" && (
					<div class="ep:inline-flex ep:items-center ep:gap-1 ep:px-2 ep:py-0.5 ep:rounded-full ep:bg-obs-interactive/10 ep:text-obs-interactive ep:text-ui-smaller ep:font-medium">
						{pf.name}
						<Clickable
							class="ep:ml-0.5 ep:text-obs-muted ep:hover:text-obs-normal ep:text-[10px]"
							onClick={() => {
								projectFilter.value = { type: "none" };
							}}
							aria-label="Clear project filter"
						>
							✕
						</Clickable>
					</div>
				)}
			</div>

			{/* State filters */}
			<div class="ep:shrink-0 ep:mb-3">
				<NoteFilters
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
									onProjectClick={handleProjectClick}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
