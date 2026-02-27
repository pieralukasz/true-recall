import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components/Clickable";
import { SelectNoteModal } from "@shared/ui/modals/SelectNoteModal";
import { usePlugin } from "@shared/ui/preact";
import { useIcon } from "@shared/ui/preact/hooks";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import type { RefObject } from "preact";
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
	onNavigateToNote: (noteName: string) => void;
	onStudyNote: (noteName: string) => void;
	onCustomStudyNote: (noteName: string) => void;
}

export function ProjectsTab({
	projects,
	searchQuery,
	scrollContainerRef,
	scrollTop,
	onNavigateToNote,
	onStudyNote,
	onCustomStudyNote,
}: ProjectsTabProps) {
	const plugin = usePlugin();
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

	const toggleExpand = (path: string) => {
		const next = new Set(expandedPaths.value);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		expandedPaths.value = next;
	};

	const handleAddProject = useCallback(async () => {
		const existingPaths = new Set(
			plugin.projectLinkService.getAllProjectPaths(),
		);
		const modal = new SelectNoteModal(plugin.app, {
			title: "Add project",
			description: "Select a note to mark as a project.",
			excludePaths: existingPaths,
		});
		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNote) return;

		await plugin.app.fileManager.processFrontMatter(
			result.selectedNote,
			(fm: Record<string, unknown>) => {
				fm.project = true;
			},
		);
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
				{virtualItems.map(({ item, offsetTop }) => {
					if (item.type === "project-header") {
						return (
							<div
								key={`p-${item.project.path}`}
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
									onToggle={() => toggleExpand(item.project.path)}
									onStudyProject={() => {
										void plugin.openReviewViewWithFilters({
											projectPath: item.project.path,
											ignoreDailyLimits: true,
										});
									}}
								/>
							</div>
						);
					}

					if (item.type === "note") {
						return (
							<div
								key={`n-${item.note.name}`}
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
									onNavigate={() =>
										onNavigateToNote(item.note.name)
									}
									onStudy={() => onStudyNote(item.note.name)}
									onCustomStudy={() =>
										onCustomStudyNote(item.note.name)
									}
								/>
							</div>
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
			{addButton}
		</div>
	);
}
