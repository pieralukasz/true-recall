import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { TFile } from "obsidian";
import type { RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { getDragClass } from "../helpers/drag-drop";
import { UNASSIGNED_PATH } from "../helpers/project-aggregation";
import type { FlatProjectItem } from "../helpers/project-tree-flatten";
import {
	collectMatchingPaths,
	flattenProjectTree,
} from "../helpers/project-tree-flatten";
import { useNoteBulkActions } from "../helpers/use-note-bulk-actions";
import { useNoteContextMenu } from "../helpers/use-note-context-menu";
import { useNoteSelection } from "../helpers/use-note-selection";
import { useProjectActions } from "../helpers/use-project-actions";
import { useProjectContextMenu } from "../helpers/use-project-context-menu";
import { useProjectDragDrop } from "../helpers/use-project-drag-drop";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import type { DashboardProject } from "../types";
import { NoteRow } from "./NoteRow";
import { EmptyProjectRow, ProjectHeaderRow } from "./ProjectHeaderRow";
import { SelectionBar } from "./SelectionBar";

interface ProjectsTabProps {
	projects: DashboardProject[];
	searchQuery: string;
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
	onStudyNote: (noteName: string, projectPath?: string) => void;
	onPresetClick?: (path: string | null) => void;
}

export function ProjectsTab({
	projects,
	searchQuery,
	scrollContainerRef,
	scrollTop,
	onStudyNote,
	onPresetClick,
}: ProjectsTabProps) {
	const plugin = usePlugin();
	const expandedPaths = useSignal<ReadonlySet<string>>(new Set());
	const contentRef = useRef<HTMLDivElement>(null);

	const {
		handleArchive,
		handleRename,
		handleDissolve,
		handleMoveChildren,
		handleDelete,
		handleExportAnki,
		handleExportCsv,
		handleCreateSubProject,
		handleConvertToProject,
		handleRemoveProjectStatus,
		handleAssignNoteToProject,
	} = useProjectActions();
	const {
		dragState,
		handleDragStart,
		handleDragEnd,
		handleDragOver,
		handleDrop,
		handleTopDrop,
		handleBottomDrop,
	} = useProjectDragDrop();

	useEffect(() => {
		if (!searchQuery) return;
		expandedPaths.value = collectMatchingPaths(projects, searchQuery);
	}, [searchQuery, projects]);

	const flatItems = useMemo(
		() => flattenProjectTree(projects, expandedPaths.value, searchQuery),
		[projects, expandedPaths.value, searchQuery],
	);

	const allNotes = useMemo(
		() => flatItems.filter((i) => i.type === "note").map((i) => i.note),
		[flatItems],
	);

	const {
		selectedPaths,
		selectedCount,
		isSelecting,
		exitSelection,
		toggleSelect,
		enterSelection,
		selectAll,
	} = useNoteSelection({ filteredNotes: allNotes });

	const {
		handleCreateProjectFromSelected,
		handleAssignToProject,
		handleArchiveSelected,
		handleStudySelected,
	} = useNoteBulkActions({
		selectedPaths,
		filteredNotes: allNotes,
		exitSelection,
	});

	const { totalHeight, virtualItems } = useExternalVirtualList({
		items: flatItems,
		scrollContainerRef,
		scrollTop,
		contentOffsetRef: contentRef,
	});

	const toggleExpand = useCallback(
		(path: string) => {
			const next = new Set(expandedPaths.value);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			expandedPaths.value = next;
		},
		[expandedPaths],
	);

	// ── Render ───────────────────────────────────────────

	if (flatItems.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
				{projects.length === 0
					? "No projects found. Organize notes in folders or add include: folder to a note's frontmatter."
					: "No matching projects."}
			</div>
		);
	}

	return (
		<div>
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

			{dragState.value && (
				<RootDropZone
					position="top"
					label={
						dragState.value.item.parentPath
							? "Move to root level"
							: "Convert to project"
					}
					onDrop={handleTopDrop}
				/>
			)}

			<div
				ref={contentRef}
				style={{ height: `${totalHeight}px`, position: "relative" }}
			>
				{virtualItems.map(({ item, offsetTop }) => {
					if (item.type === "project-header") {
						return (
							<ProjectHeaderItem
								key={`p-${item.project.path}`}
								item={item}
								offsetTop={offsetTop}
								dragState={dragState}
								plugin={plugin}
								onPresetClick={onPresetClick}
								onToggleExpand={toggleExpand}
								onArchive={handleArchive}
								onRename={handleRename}
								onDissolve={handleDissolve}
								onMoveChildren={handleMoveChildren}
								onDelete={handleDelete}
								onExportAnki={handleExportAnki}
								onExportCsv={handleExportCsv}
								onCreateSubProject={handleCreateSubProject}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
								onDragOver={handleDragOver}
								onDrop={handleDrop}
							/>
						);
					}

					if (item.type === "note") {
						return (
							<NoteItem
								key={`n-${item.note.name}`}
								item={item}
								offsetTop={offsetTop}
								dragState={dragState}
								isSelecting={isSelecting}
								isSelected={
									item.note.path
										? selectedPaths.value.has(item.note.path)
										: false
								}
								plugin={plugin}
								onStudyNote={onStudyNote}
								onPresetClick={onPresetClick}
								onArchive={handleArchive}
								onRename={handleRename}
								onCreateProject={handleConvertToProject}
								onRemoveProjectStatus={handleRemoveProjectStatus}
								onAssignToProject={handleAssignNoteToProject}
								onToggleSelect={
									item.note.path
										? () => {
												const p = item.note.path;
												if (p) toggleSelect(p);
											}
										: undefined
								}
								onEnterSelection={
									item.note.path
										? () => {
												const p = item.note.path;
												if (p) enterSelection(p);
											}
										: undefined
								}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
								onDragOver={handleDragOver}
								onDrop={handleDrop}
							/>
						);
					}

					return (
						<div
							key={`e-${item.projectPath}`}
							style={{
								position: "absolute",
								top: `${offsetTop}px`,
								left: 0,
								right: 0,
								height: "36px",
							}}
						>
							<EmptyProjectRow depth={item.depth} />
						</div>
					);
				})}
			</div>

			{dragState.value && (
				<RootDropZone
					position="bottom"
					label={
						dragState.value.item.parentPath ? "Move to root level" : "Archive"
					}
					onDrop={handleBottomDrop}
				/>
			)}
		</div>
	);
}

// ── Sub-components ──────────────────────────────────────

interface ProjectHeaderItemProps {
	item: Extract<FlatProjectItem, { type: "project-header" }>;
	offsetTop: number;
	dragState: Signal<import("../helpers/drag-drop").DragState | null>;
	plugin: ReturnType<typeof usePlugin>;
	onPresetClick?: (path: string | null) => void;
	onToggleExpand: (path: string) => void;
	onArchive: (path: string, archived: boolean) => void;
	onRename: (path: string) => Promise<void>;
	onDissolve: (path: string) => Promise<void>;
	onMoveChildren: (path: string) => Promise<void>;
	onDelete: (path: string) => Promise<void>;
	onExportAnki: (path: string) => Promise<void>;
	onExportCsv: (path: string) => Promise<void>;
	onCreateSubProject: (path: string) => Promise<void>;
	onDragStart: (e: DragEvent, item: FlatProjectItem) => void;
	onDragEnd: () => void;
	onDragOver: (e: DragEvent, item: FlatProjectItem) => void;
	onDrop: (e: DragEvent, item: FlatProjectItem) => void;
}

function ProjectHeaderItem({
	item,
	offsetTop,
	dragState,
	plugin,
	onPresetClick,
	onToggleExpand,
	onArchive,
	onRename,
	onDissolve,
	onMoveChildren,
	onDelete,
	onExportAnki,
	onExportCsv,
	onCreateSubProject,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
}: ProjectHeaderItemProps) {
	const isVirtual = item.project.path === UNASSIGNED_PATH;
	const dragCls = getDragClass(dragState.value, item.project.path);

	const handleStudyProject = () => {
		if (isVirtual) {
			void plugin.openCustomStudyModal({
				sourceNoteFilters: item.project.memberNotes.map((m) => m.name),
				scopeLabel: "Unassigned",
			});
		} else {
			void plugin.startReview({
				mode: "project",
				projectPath: item.project.path,
			});
		}
	};

	const handleCustomStudy = () => {
		void plugin.openCustomStudyModal({
			sourceNoteFilters: item.project.memberNotes.map((m) => m.name),
			scopeLabel: item.project.name,
		});
	};

	const handleContextMenu = useProjectContextMenu({
		project: item.project,
		isVirtual,
		onStudyProject: handleStudyProject,
		onCustomStudy: handleCustomStudy,
		onNavigate: isVirtual
			? undefined
			: () => void plugin.app.workspace.openLinkText(item.project.name, ""),
		onPresetClick: isVirtual
			? undefined
			: () => onPresetClick?.(item.project.path),
		onRename: isVirtual ? undefined : () => void onRename(item.project.path),
		onArchive: isVirtual ? undefined : () => onArchive(item.project.path, true),
		onUnarchive: isVirtual
			? undefined
			: () => onArchive(item.project.path, false),
		onDissolve: isVirtual
			? undefined
			: () => void onDissolve(item.project.path),
		onMoveChildren: isVirtual
			? undefined
			: () => void onMoveChildren(item.project.path),
		onDelete: isVirtual ? undefined : () => void onDelete(item.project.path),
		onExportAnki: () => void onExportAnki(item.project.path),
		onExportCsv: () => void onExportCsv(item.project.path),
		onCreateSubProject: isVirtual
			? undefined
			: () => void onCreateSubProject(item.project.path),
	});

	return (
		<div
			role="listitem"
			class={dragCls || undefined}
			draggable={!isVirtual}
			onDragStart={isVirtual ? undefined : (e) => onDragStart(e, item)}
			onDragEnd={isVirtual ? undefined : onDragEnd}
			onDragOver={isVirtual ? undefined : (e) => onDragOver(e, item)}
			onDrop={isVirtual ? undefined : (e) => onDrop(e, item)}
			style={{
				position: "absolute",
				top: `${offsetTop}px`,
				left: 0,
				right: 0,
				height: "36px",
			}}
		>
			<ProjectHeaderRow
				project={item.project}
				depth={item.depth}
				isExpanded={item.isExpanded}
				isVirtual={isVirtual}
				onToggle={() => onToggleExpand(item.project.path)}
				onStudyProject={handleStudyProject}
				onCustomStudy={handleCustomStudy}
				onContextMenu={handleContextMenu}
				onNavigate={
					isVirtual
						? undefined
						: () => {
								void plugin.app.workspace.openLinkText(item.project.name, "");
							}
				}
				onPresetClick={isVirtual ? undefined : onPresetClick}
				onArchive={
					isVirtual ? undefined : () => onArchive(item.project.path, true)
				}
				onUnarchive={
					isVirtual ? undefined : () => onArchive(item.project.path, false)
				}
				onRename={
					isVirtual ? undefined : () => void onRename(item.project.path)
				}
			/>
		</div>
	);
}

interface NoteItemProps {
	item: Extract<FlatProjectItem, { type: "note" }>;
	offsetTop: number;
	dragState: Signal<import("../helpers/drag-drop").DragState | null>;
	isSelecting: boolean;
	isSelected: boolean;
	plugin: ReturnType<typeof usePlugin>;
	onStudyNote: (noteName: string, projectPath?: string) => void;
	onPresetClick?: (path: string | null) => void;
	onArchive: (path: string, archived: boolean) => void;
	onRename: (path: string) => Promise<void>;
	onCreateProject: (path: string) => Promise<void>;
	onRemoveProjectStatus: (path: string) => Promise<void>;
	onAssignToProject: (path: string) => Promise<void>;
	onToggleSelect?: () => void;
	onEnterSelection?: () => void;
	onDragStart: (e: DragEvent, item: FlatProjectItem) => void;
	onDragEnd: () => void;
	onDragOver: (e: DragEvent, item: FlatProjectItem) => void;
	onDrop: (e: DragEvent, item: FlatProjectItem) => void;
}

function NoteItem({
	item,
	offsetTop,
	dragState,
	isSelecting,
	isSelected,
	plugin,
	onStudyNote,
	onPresetClick,
	onArchive,
	onRename,
	onCreateProject,
	onRemoveProjectStatus,
	onAssignToProject,
	onToggleSelect,
	onEnterSelection,
	onDragStart,
	onDragEnd,
	onDragOver,
	onDrop,
}: NoteItemProps) {
	const dragCls = getDragClass(dragState.value, item.note.path);

	const handleNavigate = () =>
		void plugin.app.workspace.openLinkText(item.note.name, "");

	const handleStudy = () => onStudyNote(item.note.name, item.projectPath);

	const handleCustomStudy = () => {
		void plugin.openCustomStudyModal({
			sourceNoteFilters: [item.note.name],
			scopeLabel: item.note.name,
		});
	};

	const handleDetach =
		item.projectPath !== UNASSIGNED_PATH
			? () => {
					if (!item.note.path) return;
					const file = plugin.app.vault.getAbstractFileByPath(item.note.path);
					if (!(file instanceof TFile)) return;
					const parentName =
						item.projectPath.split("/").pop()?.replace(/\.md$/, "") ?? "";
					void plugin.flashcardManager
						.getFrontmatterService()
						.removeParent(file.path, parentName);
				}
			: undefined;

	const notePath = item.note.path;
	const isUnassigned = item.projectPath === UNASSIGNED_PATH;
	const isExplicitProject =
		notePath && plugin.hierarchyService.isExplicitProject(notePath);
	const handleContextMenu = useNoteContextMenu({
		note: item.note,
		onStudy: handleStudy,
		onCustomStudy: handleCustomStudy,
		onNavigate: handleNavigate,
		onRename: notePath ? () => void onRename(notePath) : undefined,
		onArchive: notePath ? () => onArchive(notePath, true) : undefined,
		onUnarchive: notePath ? () => onArchive(notePath, false) : undefined,
		onDetach: handleDetach,
		onEnterSelection,
		onCreateProject:
			isUnassigned && notePath && !isExplicitProject
				? () => void onCreateProject(notePath)
				: undefined,
		onRemoveProjectStatus:
			isExplicitProject && notePath
				? () => void onRemoveProjectStatus(notePath)
				: undefined,
		onAssignToProject:
			isUnassigned && notePath
				? () => void onAssignToProject(notePath)
				: undefined,
	});

	return (
		<div
			role="listitem"
			class={dragCls || undefined}
			draggable={!isSelecting && !!item.note.path}
			onDragStart={(e) => onDragStart(e, item)}
			onDragEnd={onDragEnd}
			onDragOver={(e) => onDragOver(e, item)}
			onDrop={(e) => onDrop(e, item)}
			style={{
				position: "absolute",
				top: `${offsetTop}px`,
				left: 0,
				right: 0,
				height: "36px",
				paddingLeft: `${item.depth * 20}px`,
			}}
		>
			<NoteRow
				note={item.note}
				onContextMenu={handleContextMenu}
				onNavigate={handleNavigate}
				onStudy={handleStudy}
				onCustomStudy={handleCustomStudy}
				onPresetClick={onPresetClick}
				isSelectionMode={isSelecting}
				isSelected={isSelected}
				onToggleSelect={onToggleSelect}
				onEnterSelection={onEnterSelection}
				onArchive={() =>
					item.note.path ? onArchive(item.note.path, true) : undefined
				}
				onUnarchive={() =>
					item.note.path ? onArchive(item.note.path, false) : undefined
				}
				onRename={() =>
					item.note.path ? void onRename(item.note.path) : undefined
				}
				onDetach={handleDetach}
			/>
		</div>
	);
}

function RootDropZone({
	position,
	label,
	onDrop,
}: {
	position: "top" | "bottom";
	label: string;
	onDrop: (e: DragEvent) => void;
}) {
	const spacing = position === "top" ? "ep:mb-1" : "ep:mt-1";
	return (
		<div
			role="listitem"
			class={`ep:h-10 ep:mx-2 ${spacing} ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:flex ep:items-center ep:justify-center ep:text-xs ep:text-obs-muted ep:transition-colors`}
			onDragOver={(e) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
				(e.currentTarget as HTMLElement).classList.add("ep-drop-root-zone");
			}}
			onDragLeave={(e) => {
				(e.currentTarget as HTMLElement).classList.remove("ep-drop-root-zone");
			}}
			onDrop={onDrop}
		>
			{label}
		</div>
	);
}
