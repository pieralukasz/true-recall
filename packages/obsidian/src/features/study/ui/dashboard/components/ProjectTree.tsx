import { ROW_HEIGHT } from "../helpers/use-virtual-list";
import { ProjectDropZone } from "./ProjectDropZones";
import { EmptyProjectRow } from "./ProjectHeaderRow";
import { ProjectNoteRow, type ProjectNoteRowProps } from "./ProjectNoteRow";
import { ProjectRow } from "./ProjectRow";
import type { ProjectsTabModel } from "./useProjectsTabModel";
export function ProjectTree({
	model,
	onStudyNote,
	onPresetClick,
}: {
	model: ProjectsTabModel;
	onStudyNote: ProjectNoteRowProps["onStudyNote"];
	onPresetClick?: ProjectNoteRowProps["onPresetClick"];
}) {
	const {
		drag,
		actions,
		selection,
		totalHeight,
		contentRef,
		virtualItems,
		toggleExpand,
	} = model;
	return (
		<>
			{drag.dragState.value && (
				<ProjectDropZone
					position="top"
					label={
						drag.dragState.value.item.parentPath
							? "Move to root level"
							: "Convert to project"
					}
					onDrop={drag.handleTopDrop}
				/>
			)}
			<div
				ref={contentRef}
				style={{ height: `${totalHeight}px`, position: "relative" }}
			>
				{virtualItems.map(({ item, offsetTop }) => {
					if (item.type === "project-header")
						return (
							<ProjectRow
								key={`p-${item.project.path}`}
								item={item}
								offsetTop={offsetTop}
								actions={actions}
								drag={drag}
								onPresetClick={onPresetClick}
								onToggleExpand={toggleExpand}
							/>
						);
					if (item.type === "note")
						return (
							<ProjectNoteRow
								key={`n-${item.projectPath}-${item.note.path ?? item.note.name}`}
								item={item}
								offsetTop={offsetTop}
								actions={actions}
								drag={drag}
								selection={selection}
								onStudyNote={onStudyNote}
								onPresetClick={onPresetClick}
							/>
						);
					return (
						<div
							key={`e-${item.projectPath}`}
							style={{
								position: "absolute",
								top: `${offsetTop}px`,
								left: 0,
								right: 0,
								height: `${ROW_HEIGHT}px`,
							}}
						>
							<EmptyProjectRow depth={item.depth} />
						</div>
					);
				})}
			</div>
			{drag.dragState.value && (
				<ProjectDropZone
					position="bottom"
					label={
						drag.dragState.value.item.parentPath
							? "Move to root level"
							: "Archive"
					}
					onDrop={drag.handleBottomDrop}
				/>
			)}
		</>
	);
}
