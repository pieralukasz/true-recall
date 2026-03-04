import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components/Clickable";
import { CreateProjectModal } from "@features/study/modals/CreateProjectModal";
import { RenameModal } from "@features/study/modals/RenameModal";
import { usePlugin } from "@shared/ui/preact";
import { Notice, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";
import { useIcon } from "@shared/ui/preact/hooks";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import { useInitialMount } from "../helpers/use-initial-mount";
import { useExternalVirtualList } from "../helpers/use-virtual-list";
import {
	flattenProjectTree,
	collectMatchingPaths,
} from "../helpers/project-tree-flatten";
import type { DashboardProject } from "../types";
import { ProjectHeaderRow, EmptyProjectRow } from "./ProjectHeaderRow";
import { NoteRow } from "./NoteRow";

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
	const initialMount = useInitialMount();
	const expandedPaths = useSignal<ReadonlySet<string>>(new Set());
	const contentRef = useRef<HTMLDivElement>(null);
	const plusIconRef = useIcon("plus");

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

		// Build new path
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

		// Check if target already exists
		if (plugin.app.vault.getAbstractFileByPath(newPath)) {
			new Notice(`A ${file instanceof TFolder ? "folder" : "file"} already exists at "${newPath}".`);
			return;
		}

		await plugin.app.fileManager.renameFile(file, newPath);
	}, [plugin]);

	const handleAddProject = useCallback(async () => {
		const modal = new CreateProjectModal(plugin.app);
		const result = await modal.openAndWait();
		if (result.cancelled) return;

		const folderBase = result.folder ? `${result.folder}/` : "";
		const path = normalizePath(`${folderBase}${result.name}/${result.name}.md`);

		if (plugin.app.vault.getAbstractFileByPath(path)) {
			new Notice(`A note already exists at "${path}".`);
			return;
		}

		await plugin.app.vault.create(path, "");
		await plugin.app.workspace.openLinkText(path, "", false);
	}, [plugin]);

	const addButton = (
		<div class="ep:py-3">
			<Clickable
				class="ep:flex ep:items-center ep:gap-1.5 ep:px-3 ep:py-1.5 ep:rounded-lg ep:text-sm ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors"
				onClick={() => void handleAddProject()}
			>
				<span ref={plusIconRef} class="[&_svg]:ep:w-4 [&_svg]:ep:h-4" />
				Add new project
			</Clickable>
		</div>
	);

	if (flatItems.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
				{projects.length === 0
					? "No projects found. Organize notes in folders or add project: true to a note's frontmatter."
					: "No matching projects."}
				{projects.length === 0 && addButton}
			</div>
		);
	}

	return (
		<div>
			<div
				ref={contentRef}
				style={{ height: `${totalHeight}px`, position: "relative" }}
			>
				{virtualItems.map(({ item, offsetTop, index }) => {
					const animStyle = initialMount.current
						? { "--card-index": Math.min(index, 10) }
						: {};

					if (item.type === "project-header") {
						return (
							<div
								key={`p-${item.project.path}`}
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
						return (
							<div
								key={`n-${item.note.name}`}
								class={initialMount.current ? "ep-card-enter" : undefined}
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
			{addButton}
		</div>
	);
}
