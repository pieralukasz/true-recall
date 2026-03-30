import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { prioritySortComparator } from "@true-recall/core/helpers/note-priority";
import { NamePromptModal } from "@true-recall/obsidian/modals/study/NamePromptModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice, normalizePath, TFile } from "obsidian";
import type { RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import {
	DRAG_MIME,
	type DragItem,
	type DragState,
	type DropResult,
	executeDrop,
	getDragClass,
} from "../helpers/drag-drop";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import type {
	DashboardNoteEntry,
	NoteFilterMode,
	ProjectFilter,
} from "../types";
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
	scrollContainerRef,
	scrollTop,
	onPresetClick,
}: NoteListProps) {
	const plugin = usePlugin();
	const activeFilter = useSignal<NoteFilterMode>("all");
	const projectFilter = useSignal<ProjectFilter>({ type: "none" });
	const contentRef = useRef<HTMLDivElement>(null);
	const dragState = useSignal<DragState | null>(null);
	const selectionMode = useSignal(false);
	const selectedPaths = useSignal<ReadonlySet<string>>(new Set());

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

	// ── Selection ───────────────────────────────────────

	const exitSelection = useCallback(() => {
		selectionMode.value = false;
		selectedPaths.value = new Set();
	}, [selectionMode, selectedPaths]);

	// ESC exits selection mode
	useEffect(() => {
		if (!selectionMode.value) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") exitSelection();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [selectionMode.value, exitSelection]);

	const toggleSelect = useCallback(
		(path: string) => {
			const next = new Set(selectedPaths.value);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			selectedPaths.value = next;
		},
		[selectedPaths],
	);

	const enterSelection = useCallback(
		(path: string) => {
			selectionMode.value = true;
			selectedPaths.value = new Set([path]);
		},
		[selectionMode, selectedPaths],
	);

	const selectAll = useCallback(() => {
		const paths = new Set(
			filteredNotes.filter((n) => n.path).map((n) => n.path as string),
		);
		selectedPaths.value = paths;
	}, [filteredNotes, selectedPaths]);

	const selectedCount = selectedPaths.value.size;

	// ── Bulk actions ────────────────────────────────────

	const handleCreateProjectFromSelected = useCallback(async () => {
		if (selectedCount === 0) return;

		const modal = new NamePromptModal(plugin.app, "New Project");
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		const name = result.name;
		const projectPath = normalizePath(`${name}.md`);

		if (plugin.app.vault.getAbstractFileByPath(projectPath)) {
			new Notice(`A note already exists at "${projectPath}".`);
			return;
		}

		await plugin.app.vault.create(projectPath, "");

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		for (const path of selectedPaths.value) {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await frontmatterService.addParent(file.path, name);
			}
		}

		new Notice(`Created project "${name}" with ${selectedCount} notes`);
		exitSelection();
	}, [plugin, selectedPaths, selectedCount, exitSelection]);

	const handleArchiveSelected = useCallback(async () => {
		if (selectedCount === 0) return;

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		for (const path of selectedPaths.value) {
			const file = plugin.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				await frontmatterService.setArchive(file.path, true);
			}
		}

		new Notice(`Archived ${selectedCount} notes`);
		exitSelection();
	}, [plugin, selectedPaths, selectedCount, exitSelection]);

	const handleStudySelected = useCallback(() => {
		if (selectedCount === 0) return;

		const noteNames = filteredNotes
			.filter((n) => n.path && selectedPaths.value.has(n.path))
			.map((n) => n.name);

		void plugin.openCustomStudyModal({
			sourceNoteFilters: noteNames,
			scopeLabel: `${noteNames.length} notes`,
		});

		exitSelection();
	}, [plugin, filteredNotes, selectedPaths, selectedCount, exitSelection]);

	// ── Note handlers ───────────────────────────────────

	const handleNavigateToNote = (note: DashboardNoteEntry) => {
		void plugin.app.workspace.openLinkText(note.name, "");
	};

	const handleStudyNote = (noteName: string) => {
		void plugin.openReviewViewWithFilters({
			sourceNoteFilter: noteName,
			ignoreDailyLimits: plugin.settings.ignoreDailyLimitsForNoteStudy,
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

	// ── Drag & Drop handlers (note-on-note → create project) ──

	const handleDragStart = useCallback(
		(e: DragEvent, note: DashboardNoteEntry) => {
			if (!note.path) {
				e.preventDefault();
				return;
			}
			const item: DragItem = {
				type: "note",
				path: note.path,
				name: note.name,
				parentPath: null,
			};
			e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(item));
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
			requestAnimationFrame(() => {
				dragState.value = { item, dropTargetPath: null, isValid: false };
			});
		},
		[dragState],
	);

	const handleDragEnd = useCallback(() => {
		dragState.value = null;
	}, [dragState]);

	const handleDragOver = useCallback(
		(e: DragEvent, targetNote: DashboardNoteEntry) => {
			const ds = dragState.value;
			if (!ds || !targetNote.path) return;
			if (targetNote.path === ds.item.path) return;

			if (targetNote.path !== ds.dropTargetPath) {
				dragState.value = {
					...ds,
					dropTargetPath: targetNote.path,
					isValid: true,
				};
			}

			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		},
		[dragState],
	);

	const handleDrop = useCallback(
		(e: DragEvent, targetNote: DashboardNoteEntry) => {
			e.preventDefault();
			const ds = dragState.value;
			dragState.value = null;
			if (!ds || !targetNote.path || targetNote.path === ds.item.path) return;

			const result: DropResult = {
				action: "create-project",
				dragPath: ds.item.path,
				dragName: ds.item.name,
				targetPath: targetNote.path,
				targetName: targetNote.name,
			};

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			void executeDrop(result, {
				app: plugin.app,
				frontmatterService,
				promptProjectName: async (defaultName: string) => {
					const modal = new NamePromptModal(plugin.app, defaultName);
					const res = await modal.openAndWait();
					return res.cancelled ? null : res.name;
				},
			});
		},
		[dragState, plugin],
	);

	// ── Render ──────────────────────────────────────────

	const isSelecting = selectionMode.value;

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
							<div
								role="listitem"
								key={item.name}
								class={dragCls || undefined}
								draggable={!isSelecting && !!item.path}
								onDragStart={(e) => handleDragStart(e, item)}
								onDragEnd={handleDragEnd}
								onDragOver={(e) => handleDragOver(e, item)}
								onDrop={(e) => handleDrop(e, item)}
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
									onPresetClick={onPresetClick}
									onArchive={() => handleArchiveNote(item)}
									onUnarchive={() => handleUnarchiveNote(item)}
									isSelectionMode={isSelecting}
									isSelected={
										item.path ? selectedPaths.value.has(item.path) : false
									}
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
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
