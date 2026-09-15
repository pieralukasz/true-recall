import { getDragClass } from "../helpers/drag-drop";
import type { FlatProjectItem } from "../helpers/project-tree-flatten";
import { ROW_HEIGHT } from "../helpers/use-virtual-list";
import { NoteRow } from "./NoteRow";
import { useProjectNoteActions } from "./useProjectNoteActions";
import type {
	ProjectActions,
	ProjectDragDrop,
	ProjectsTabModel,
} from "./useProjectsTabModel";
export interface ProjectNoteRowProps {
	item: Extract<FlatProjectItem, { type: "note" }>;
	offsetTop: number;
	actions: ProjectActions;
	drag: ProjectDragDrop;
	selection: ProjectsTabModel["selection"];
	onStudyNote: (name: string, projectPath?: string, count?: number) => void;
	onPresetClick?: (path: string | null) => void;
}
export function ProjectNoteRow({
	item,
	offsetTop,
	actions,
	drag,
	selection,
	onStudyNote,
	onPresetClick,
}: ProjectNoteRowProps) {
	const path = item.note.path;
	const isSelecting = selection.isSelecting;
	const isSelected = !!path && selection.selectedPaths.value.has(path);
	const onToggleSelect = path ? () => selection.toggleSelect(path) : undefined;
	const onEnterSelection = path
		? () => selection.enterSelection(path)
		: undefined;
	const {
		handleNavigate,
		handleStudy,
		handleCustomStudy,
		handleDetach,
		handleContextMenu,
	} = useProjectNoteActions(
		item,
		actions,
		onStudyNote,
		onPresetClick,
		onEnterSelection,
	);
	const dragCls = getDragClass(drag.dragState.value, path);

	return (
		<div
			role="listitem"
			class={dragCls || undefined}
			draggable={!isSelecting && !!item.note.path}
			onDragStart={(e) => drag.handleDragStart(e, item)}
			onDragEnd={drag.handleDragEnd}
			onDragOver={(e) => drag.handleDragOver(e, item)}
			onDrop={(e) => drag.handleDrop(e, item)}
			style={{
				position: "absolute",
				top: `${offsetTop}px`,
				left: 0,
				right: 0,
				height: `${ROW_HEIGHT}px`,
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
					item.note.path
						? void actions.handleArchive(item.note.path, true)
						: undefined
				}
				onUnarchive={() =>
					item.note.path
						? void actions.handleArchive(item.note.path, false)
						: undefined
				}
				onRename={() =>
					item.note.path ? void actions.handleRename(item.note.path) : undefined
				}
				onDetach={handleDetach}
			/>
		</div>
	);
}
