import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useMemo, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { TFile } from "obsidian";
import { useInitialMount } from "../helpers/use-initial-mount";
import { prioritySortComparator } from "../helpers/note-priority";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
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
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
	onPresetClick?: (path: string | null) => void;
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

export function NoteList({
	notes,
	searchQuery,
	allProjectNames,
	scrollContainerRef,
	scrollTop,
	onPresetClick,
}: NoteListProps) {
	const plugin = usePlugin();
	const initialMount = useInitialMount();
	const activeFilter = useSignal<NoteFilterMode>("all");
	const projectFilter = useSignal<ProjectFilter>({ type: "none" });
	const contentRef = useRef<HTMLDivElement>(null);

	const unassignedCount = useMemo(
		() => notes.filter((n) => n.projects.length === 0).length,
		[notes],
	);

	const projectFiltered = useMemo(() => {
		const pf = projectFilter.value;
		if (pf.type === "project")
			return notes.filter((n) => n.projects.includes(pf.name));
		if (pf.type === "unassigned")
			return notes.filter((n) => n.projects.length === 0);
		return notes;
	}, [notes, projectFilter.value]);

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

	const { totalHeight, virtualItems } = useExternalVirtualList({
		items: filteredNotes,
		scrollContainerRef,
		scrollTop,
		contentOffsetRef: contentRef,
	});

	const handleNavigateToNote = (note: DashboardNoteEntry) => {
		void plugin.app.workspace.openLinkText(note.name, "");
	};

	const handleStudyNote = (noteName: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
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

	const handleFilterChange = useCallback((f: NoteFilterMode) => {
		activeFilter.value = f;
	}, []);

	const handleProjectFilterChange = useCallback((pf: ProjectFilter) => {
		projectFilter.value = pf;
	}, []);

	const handleArchiveNote = (note: DashboardNoteEntry) => {
		if (!note.path) return;
		const file = plugin.app.vault.getAbstractFileByPath(note.path);
		if (file instanceof TFile) {
			void plugin.flashcardManager.getFrontmatterService().setArchive(file, true);
		}
	};

	const handleUnarchiveNote = (note: DashboardNoteEntry) => {
		if (!note.path) return;
		const file = plugin.app.vault.getAbstractFileByPath(note.path);
		if (file instanceof TFile) {
			void plugin.flashcardManager.getFrontmatterService().setArchive(file, false);
		}
	};

	return (
		<div class="ep:flex ep:flex-col">
			<div class="ep:shrink-0 ep:mb-3">
				<NoteFilters
					activeFilter={activeFilter.value}
					onFilterChange={handleFilterChange}
					counts={counts}
					projectFilter={projectFilter.value}
					unassignedCount={unassignedCount}
					onProjectFilterChange={handleProjectFilterChange}
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
					ref={contentRef}
					style={{
						height: `${totalHeight}px`,
						position: "relative",
					}}
				>
					{virtualItems.map(({ item, offsetTop, index }) => (
						<div
							key={item.name}
							class={initialMount.current ? "ep-card-enter" : undefined}
							style={{
								position: "absolute",
								top: `${offsetTop}px`,
								left: 0,
								right: 0,
								height: "36px",
								...(initialMount.current
									? { "--card-index": Math.min(index, 10) }
									: {}),
							}}
						>
							<NoteRow
								note={item}
								onNavigate={() => handleNavigateToNote(item)}
								onStudy={() => handleStudyNote(item.name)}
								onCustomStudy={() => handleCustomStudy(item)}
								onProjectClick={handleProjectClick}
								onPresetClick={onPresetClick}
								onArchive={() => handleArchiveNote(item)}
								onUnarchive={() => handleUnarchiveNote(item)}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
