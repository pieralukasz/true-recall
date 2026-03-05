import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { NamePromptModal } from "@features/study/modals/NamePromptModal";
import { RenameModal } from "@features/study/modals/RenameModal";
import { usePlugin } from "@shared/ui/preact";
import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { useInitialMount } from "../helpers/use-initial-mount";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import {
	flattenProjectTree,
	collectMatchingPaths,
} from "../helpers/project-tree-flatten";
import type { FlatProjectItem } from "../helpers/project-tree-flatten";
import type { DashboardProject } from "../types";
import { ProjectHeaderRow, EmptyProjectRow } from "./ProjectHeaderRow";
import { NoteRow } from "./NoteRow";
import {
	type DragItem,
	type DropResult,
	DRAG_MIME,
	dragItemFromFlatItem,
	validateDrop,
	executeDrop,
} from "../helpers/drag-drop";

interface ProjectsTabProps {
	projects: DashboardProject[];
	searchQuery: string;
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
	onStudyNote: (noteName: string, projectPath?: string) => void;
	onPresetClick?: (path: string | null) => void;
}

interface DragState {
	item: DragItem;
	dropTargetPath: string | null;
	isValid: boolean;
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
	const initialMount = useInitialMount();
	const expandedPaths = useSignal<ReadonlySet<string>>(new Set());
	const contentRef = useRef<HTMLDivElement>(null);
	const dragState = useSignal<DragState | null>(null);

	// Auto-expand matching projects when searching
	useEffect(() => {
		if (!searchQuery) return;
		expandedPaths.value = collectMatchingPaths(projects, searchQuery);
	}, [searchQuery, projects]);

	const flatItems = useMemo(
		() =>
			flattenProjectTree(projects, expandedPaths.value, searchQuery),
		[projects, expandedPaths.value, searchQuery],
	);

	const { totalHeight, virtualItems } = useExternalVirtualList({
		items: flatItems,
		scrollContainerRef,
		scrollTop,
		contentOffsetRef: contentRef,
	});

	const toggleExpand = useCallback((path: string) => {
		const next = new Set(expandedPaths.value);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		expandedPaths.value = next;
	}, [expandedPaths]);

	const handleArchive = useCallback((path: string, archived: boolean) => {
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			void plugin.flashcardManager.getFrontmatterService().setArchive(file, archived);
		}
	}, [plugin]);

	const handleRename = useCallback(async (path: string) => {
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!file) return;

		const modal = new RenameModal(plugin.app, file);
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		let newPath: string;
		if (file instanceof TFile) {
			const ext = file.extension;
			const parent = file.parent?.path ?? "";
			newPath = parent ? `${parent}/${result.newName}.${ext}` : `${result.newName}.${ext}`;
		} else {
			const parent = file.parent?.path ?? "";
			newPath = parent ? `${parent}/${result.newName}` : result.newName;
		}
		newPath = normalizePath(newPath);

		if (plugin.app.vault.getAbstractFileByPath(newPath)) {
			new Notice(`A ${file instanceof TFolder ? "folder" : "file"} already exists at "${newPath}".`);
			return;
		}

		await plugin.app.fileManager.renameFile(file, newPath);
	}, [plugin]);

	// ── Drag & Drop handlers ────────────────────────────

	const handleDragStart = useCallback(
		(e: DragEvent, item: FlatProjectItem) => {
			const dragItem = dragItemFromFlatItem(item);
			if (!dragItem) {
				e.preventDefault();
				return;
			}
			e.dataTransfer!.setData(DRAG_MIME, JSON.stringify(dragItem));
			e.dataTransfer!.effectAllowed = "move";
			dragState.value = { item: dragItem, dropTargetPath: null, isValid: false };
		},
		[dragState],
	);

	const handleDragEnd = useCallback(() => {
		dragState.value = null;
	}, [dragState]);

	const handleDragOver = useCallback(
		(e: DragEvent, targetItem: FlatProjectItem) => {
			const ds = dragState.value;
			if (!ds) return;

			const targetPath =
				targetItem.type === "project-header"
					? targetItem.project.path
					: targetItem.type === "note"
						? targetItem.note.path
						: null;

			if (!targetPath || targetPath === ds.dropTargetPath) {
				if (ds.isValid) e.preventDefault();
				return;
			}

			const result = validateDrop(
				ds.item,
				targetItem,
				plugin.hierarchyService,
			);

			dragState.value = {
				...ds,
				dropTargetPath: targetPath,
				isValid: result !== null,
			};

			if (result) {
				e.preventDefault();
				e.dataTransfer!.dropEffect = "move";
			}
		},
		[dragState, plugin],
	);

	const handleDrop = useCallback(
		(e: DragEvent, targetItem: FlatProjectItem) => {
			e.preventDefault();
			const ds = dragState.value;
			dragState.value = null;
			if (!ds) return;

			const result = validateDrop(
				ds.item,
				targetItem,
				plugin.hierarchyService,
			);
			if (!result) return;

			const frontmatterService = plugin.flashcardManager.getFrontmatterService();
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

	const handleRootDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault();
			const ds = dragState.value;
			dragState.value = null;
			if (!ds || !ds.item.parentPath) return;

			const parentName =
				(ds.item.parentPath.split("/").pop() ?? ds.item.parentPath).replace(/\.md$/, "");

			const result: DropResult = {
				action: "unnest",
				dragPath: ds.item.path,
				dragName: ds.item.name,
				parentPath: ds.item.parentPath,
				parentName,
			};

			const frontmatterService = plugin.flashcardManager.getFrontmatterService();
			void executeDrop(result, {
				app: plugin.app,
				frontmatterService,
				promptProjectName: async () => null,
			});
		},
		[dragState, plugin],
	);

	// ── CSS class helpers ────────────────────────────────

	function getDragClass(itemPath: string | null): string {
		const ds = dragState.value;
		if (!ds || !itemPath) return "";
		if (ds.item.path === itemPath) return "ep-drag-source";
		if (ds.dropTargetPath === itemPath && ds.isValid) return "ep-drop-target";
		return "";
	}

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
			{/* Root drop zone (top) — visible only during drag, allows un-nesting */}
			{dragState.value && dragState.value.item.parentPath && (
				<div
					class="ep:h-10 ep:mx-2 ep:mb-1 ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:flex ep:items-center ep:justify-center ep:text-xs ep:text-obs-muted ep:transition-colors"
					onDragOver={(e) => {
						e.preventDefault();
						e.dataTransfer!.dropEffect = "move";
						(e.currentTarget as HTMLElement).classList.add("ep-drop-root-zone");
					}}
					onDragLeave={(e) => {
						(e.currentTarget as HTMLElement).classList.remove("ep-drop-root-zone");
					}}
					onDrop={handleRootDrop}
				>
					Move to root level
				</div>
			)}

			<div
				ref={contentRef}
				style={{ height: `${totalHeight}px`, position: "relative" }}
			>
				{virtualItems.map(({ item, offsetTop, index }) => {
					const animStyle = initialMount.current
						? { "--card-index": Math.min(index, 10) }
						: {};

					if (item.type === "project-header") {
						const dragCls = getDragClass(item.project.path);
						return (
							<div
								key={`p-${item.project.path}`}
								class={`${initialMount.current ? "ep-card-enter" : ""} ${dragCls}`.trim() || undefined}
								draggable
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
									...animStyle,
								}}
							>
								<ProjectHeaderRow
									project={item.project}
									depth={item.depth}
									isExpanded={item.isExpanded}
									onToggle={() => toggleExpand(item.project.path)}
									onStudyProject={() => {
										void plugin.openReviewViewWithFilters({
											projectPath: item.project.path,
										});
									}}
									onCustomStudy={() => {
										void plugin.openCustomStudyModal({
											sourceNoteFilters: item.project.memberNotes.map((m) => m.name),
											scopeLabel: item.project.name,
										});
									}}
									onNavigate={() => {
										void plugin.app.workspace.openLinkText(
											item.project.name,
											"",
										);
									}}
									onPresetClick={onPresetClick}
									onArchive={() => handleArchive(item.project.path, true)}
									onUnarchive={() => handleArchive(item.project.path, false)}
									onRename={() => handleRename(item.project.path)}
								/>
							</div>
						);
					}

					if (item.type === "note") {
						const dragCls = getDragClass(item.note.path);
						return (
							<div
								key={`n-${item.note.name}`}
								class={`${initialMount.current ? "ep-card-enter" : ""} ${dragCls}`.trim() || undefined}
								draggable
								onMouseDown={(e) => {
									if ((e.target as HTMLElement) !== e.currentTarget) e.preventDefault();
								}}
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
									paddingLeft: `${item.depth * 20}px`,
									...animStyle,
								}}
							>
								<NoteRow
									note={item.note}
									onNavigate={() =>
										void plugin.app.workspace.openLinkText(
											item.note.name,
											"",
										)
									}
									onStudy={() => onStudyNote(item.note.name, item.projectPath)}
									onCustomStudy={() => {
										void plugin.openCustomStudyModal({
											sourceNoteFilters: [item.note.name],
											scopeLabel: item.note.name,
										});
									}}
									onPresetClick={onPresetClick}
									onArchive={() => item.note.path ? handleArchive(item.note.path, true) : undefined}
									onUnarchive={() => item.note.path ? handleArchive(item.note.path, false) : undefined}
									onRename={() => item.note.path ? handleRename(item.note.path) : undefined}
									onDetach={() => {
										if (!item.note.path) return;
										const file = plugin.app.vault.getAbstractFileByPath(item.note.path);
										if (!(file instanceof TFile)) return;
										const parentName = item.projectPath.split("/").pop()?.replace(/\.md$/, "") ?? "";
										void plugin.flashcardManager.getFrontmatterService().removeParent(file, parentName);
									}}
								/>
							</div>
						);
					}

					return (
						<div
							key={`e-${item.projectPath}`}
							class={initialMount.current ? "ep-card-enter" : undefined}
							style={{
								position: "absolute",
								top: `${offsetTop}px`,
								left: 0,
								right: 0,
								height: "36px",
								...animStyle,
							}}
						>
							<EmptyProjectRow depth={item.depth} />
						</div>
					);
				})}
			</div>

			{/* Root drop zone — visible only during drag, allows un-nesting */}
			{dragState.value && dragState.value.item.parentPath && (
				<div
					class="ep:h-10 ep:mx-2 ep:mt-1 ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:flex ep:items-center ep:justify-center ep:text-xs ep:text-obs-muted ep:transition-colors"
					onDragOver={(e) => {
						e.preventDefault();
						e.dataTransfer!.dropEffect = "move";
						(e.currentTarget as HTMLElement).classList.add("ep-drop-root-zone");
					}}
					onDragLeave={(e) => {
						(e.currentTarget as HTMLElement).classList.remove("ep-drop-root-zone");
					}}
					onDrop={handleRootDrop}
				>
					Move to root level
				</div>
			)}
		</div>
	);
}
