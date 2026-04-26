import type { Signal } from "@preact/signals";
import { TFile } from "obsidian";
import type { RefObject } from "preact";
import { useRef } from "preact/hooks";

import { usePlugin } from "@true-recall/obsidian/preact";

import { getDragClass } from "../helpers/drag-drop";
import { useNoteBulkActions } from "../helpers/use-note-bulk-actions";
import { useNoteContextMenu } from "../helpers/use-note-context-menu";
import { useNoteDragDrop } from "../helpers/use-note-drag-drop";
import { useNoteFiltering } from "../helpers/use-note-filtering";
import { useNoteSelection } from "../helpers/use-note-selection";
import {
	ROW_HEIGHT,
	useExternalVirtualList,
} from "../helpers/use-virtual-list";
import type { DashboardNoteEntry } from "../types";
import { NoteFilters } from "./NoteFilters";
import { NoteRow } from "./NoteRow";
import { SelectionBar } from "./SelectionBar";

interface NoteListProps {
	notes: DashboardNoteEntry[];
	searchQuery: string;
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
	onPresetClick?: (path: string | null) => void;
}

export function NoteList({
	notes,
	searchQuery,
	scrollContainerRef,
	scrollTop,
	onPresetClick,
}: NoteListProps) {
	const plugin = usePlugin();
	const contentRef = useRef<HTMLDivElement>(null);

	const {
		activeFilter,
		projectFilter,
		filteredNotes,
		counts,
		unassignedCount,
		handleFilterChange,
		handleProjectFilterChange,
	} = useNoteFiltering({ notes, searchQuery });

	const {
		selectedPaths,
		selectedCount,
		isSelecting,
		exitSelection,
		toggleSelect,
		enterSelection,
		selectAll,
	} = useNoteSelection({ filteredNotes });

	const {
		handleCreateProjectFromSelected,
		handleAssignToProject,
		handleArchiveSelected,
		handleStudySelected,
	} = useNoteBulkActions({ selectedPaths, filteredNotes, exitSelection });

	const {
		dragState,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDrop,
	} = useNoteDragDrop();

	const { totalHeight, virtualItems } = useExternalVirtualList({
		items: filteredNotes,
		scrollContainerRef,
		scrollTop,
		contentOffsetRef: contentRef,
	});

	// ── Note handlers ───────────────────────────────────

	const handleNavigateToNote = (note: DashboardNoteEntry) => {
		void plugin.app.workspace.openLinkText(note.name, "");
	};

	const handleStudyNote = (noteName: string) => {
		void plugin.startReview({ mode: "notes", noteNames: [noteName] });
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

	const handleArchiveNote = (note: DashboardNoteEntry) => {
		if (!note.path) return;
		const file = plugin.app.vault.getAbstractFileByPath(note.path);
		if (file instanceof TFile) {
			void plugin.flashcardManager
				.getFrontmatterService()
				.setArchive(file.path, true);
		}
	};

	const handleUnarchiveNote = (note: DashboardNoteEntry) => {
		if (!note.path) return;
		const file = plugin.app.vault.getAbstractFileByPath(note.path);
		if (file instanceof TFile) {
			void plugin.flashcardManager
				.getFrontmatterService()
				.setArchive(file.path, false);
		}
	};

	// ── Render ──────────────────────────────────────────

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

			{isSelecting && (
				<SelectionBar
					selectedCount={selectedCount}
					onSelectAll={selectAll}
					onCreateProject={() => void handleCreateProjectFromSelected()}
					onAssignToProject={() => void handleAssignToProject()}
					onArchive={() => void handleArchiveSelected()}
					onStudy={handleStudySelected}
					onCancel={exitSelection}
				/>
			)}

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
					{virtualItems.map(({ item, offsetTop }) => {
						const dragCls = getDragClass(dragState.value, item.path);
						return (
							<NoteListItem
								key={item.name}
								note={item}
								offsetTop={offsetTop}
								dragCls={dragCls}
								isSelecting={isSelecting}
								isSelected={
									item.path ? selectedPaths.value.has(item.path) : false
								}
								onNavigate={() => handleNavigateToNote(item)}
								onStudy={() => handleStudyNote(item.name)}
								onCustomStudy={() => handleCustomStudy(item)}
								onProjectClick={handleProjectClick}
								onPresetClick={onPresetClick}
								onArchive={() => handleArchiveNote(item)}
								onUnarchive={() => handleUnarchiveNote(item)}
								onToggleSelect={
									item.path
										? () => {
												const p = item.path;
												if (p) toggleSelect(p);
											}
										: undefined
								}
								onEnterSelection={
									item.path
										? () => {
												const p = item.path;
												if (p) enterSelection(p);
											}
										: undefined
								}
								onDragStart={(e) => handleDragStart(e, item)}
								onDragEnd={handleDragEnd}
								onDragOver={(e) => handleDragOver(e, item)}
								onDrop={(e) => handleDrop(e, item)}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}

// ── Sub-component ──────────────────────────────────────

interface NoteListItemProps {
	note: DashboardNoteEntry;
	offsetTop: number;
	dragCls: string | null;
	isSelecting: boolean;
	isSelected: boolean;
	onNavigate: () => void;
	onStudy: () => void;
	onCustomStudy: () => void;
	onProjectClick: (projectName: string) => void;
	onPresetClick?: (path: string | null) => void;
	onArchive: () => void;
	onUnarchive: () => void;
	onToggleSelect?: () => void;
	onEnterSelection?: () => void;
	onDragStart: (e: DragEvent) => void;
	onDragEnd: () => void;
	onDragOver: (e: DragEvent) => void;
	onDrop: (e: DragEvent) => void;
}

function NoteListItem({
	note,
	offsetTop,
	dragCls,
	isSelecting,
	isSelected,
	onNavigate,
	onStudy,
	onCustomStudy,
	onProjectClick,
	onPresetClick,
	onArchive,
	onUnarchive,
	onToggleSelect,
	onEnterSelection,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
}: NoteListItemProps) {
	const handleContextMenu = useNoteContextMenu({
		note,
		onStudy,
		onCustomStudy,
		onNavigate,
		onSetPreset:
			onPresetClick && note.path
				? () => onPresetClick(note.path ?? null)
				: undefined,
		onArchive,
		onUnarchive,
		onEnterSelection,
	});

	return (
		<div
			role="listitem"
			class={dragCls || undefined}
			draggable={!isSelecting && !!note.path}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onDragOver={onDragOver}
			onDrop={onDrop}
			style={{
				position: "absolute",
				top: `${offsetTop}px`,
				left: 0,
				right: 0,
				height: `${ROW_HEIGHT}px`,
			}}
		>
			<NoteRow
				note={note}
				onContextMenu={handleContextMenu}
				onNavigate={onNavigate}
				onStudy={onStudy}
				onCustomStudy={onCustomStudy}
				onProjectClick={onProjectClick}
				onPresetClick={onPresetClick}
				onArchive={onArchive}
				onUnarchive={onUnarchive}
				isSelectionMode={isSelecting}
				isSelected={isSelected}
				onToggleSelect={onToggleSelect}
				onEnterSelection={onEnterSelection}
			/>
		</div>
	);
}
