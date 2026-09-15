import { usePlugin } from "@true-recall/obsidian/preact";

import { getDragClass } from "../helpers/drag-drop";
import type { FlatProjectItem } from "../helpers/project-tree-flatten";
import { ROW_HEIGHT } from "../helpers/use-virtual-list";
import { ProjectHeaderRow } from "./ProjectHeaderRow";
import { useProjectRowActions } from "./useProjectRowActions";
import type { ProjectActions, ProjectDragDrop } from "./useProjectsTabModel";
export interface ProjectRowProps {
	item: Extract<FlatProjectItem, { type: "project-header" }>;
	offsetTop: number;
	actions: ProjectActions;
	drag: ProjectDragDrop;
	onPresetClick?: (path: string | null) => void;
	onToggleExpand: (path: string) => void;
}

export function ProjectRow({
	item,
	offsetTop,
	actions,
	drag,
	onPresetClick,
	onToggleExpand,
}: ProjectRowProps) {
	const plugin = usePlugin();
	const {
		isVirtual,
		handleStudyProject,
		handleCustomStudy,
		handleContextMenu,
	} = useProjectRowActions(item, actions, onPresetClick);
	const dragCls = getDragClass(drag.dragState.value, item.project.path);

	return (
		<div
			role="listitem"
			class={dragCls || undefined}
			draggable={!isVirtual}
			onDragStart={isVirtual ? undefined : (e) => drag.handleDragStart(e, item)}
			onDragEnd={isVirtual ? undefined : drag.handleDragEnd}
			onDragOver={isVirtual ? undefined : (e) => drag.handleDragOver(e, item)}
			onDrop={isVirtual ? undefined : (e) => drag.handleDrop(e, item)}
			style={{
				position: "absolute",
				top: `${offsetTop}px`,
				left: 0,
				right: 0,
				height: `${ROW_HEIGHT}px`,
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
					isVirtual
						? undefined
						: () => void actions.handleArchive(item.project.path, true)
				}
				onUnarchive={
					isVirtual
						? undefined
						: () => void actions.handleArchive(item.project.path, false)
				}
				onRename={
					isVirtual
						? undefined
						: () => void actions.handleRename(item.project.path)
				}
			/>
		</div>
	);
}
