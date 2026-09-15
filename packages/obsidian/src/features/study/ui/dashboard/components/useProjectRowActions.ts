import { usePlugin } from "@true-recall/obsidian/preact";

import { buildProjectCustomStudyScope } from "../helpers/custom-study-scope";
import { UNASSIGNED_PATH } from "../helpers/project-aggregation";
import type { FlatProjectItem } from "../helpers/project-tree-flatten";
import { useProjectContextMenu } from "../helpers/use-project-context-menu";
import type { ProjectActions } from "./useProjectsTabModel";
export function useProjectRowActions(
	item: Extract<FlatProjectItem, { type: "project-header" }>,
	actions: ProjectActions,
	onPresetClick?: (path: string | null) => void,
) {
	const plugin = usePlugin();
	const isVirtual = item.project.path === UNASSIGNED_PATH;

	const handleStudyProject = (rModeTargetCount?: number) => {
		if (isVirtual) {
			void plugin.openCustomStudyModal(
				buildProjectCustomStudyScope(item.project),
			);
		} else {
			void plugin.startReview({
				mode: "project",
				projectPath: item.project.path,
				rModeTargetCount,
			});
		}
	};

	const handleCustomStudy = () => {
		void plugin.openCustomStudyModal(
			buildProjectCustomStudyScope(item.project),
		);
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
		onRename: isVirtual
			? undefined
			: () => void actions.handleRename(item.project.path),
		onArchive: isVirtual
			? undefined
			: () => void actions.handleArchive(item.project.path, true),
		onUnarchive: isVirtual
			? undefined
			: () => void actions.handleArchive(item.project.path, false),
		onDissolve: isVirtual
			? undefined
			: () => void actions.handleDissolve(item.project.path),
		onMoveChildren: isVirtual
			? undefined
			: () => void actions.handleMoveChildren(item.project.path),
		onDelete: isVirtual
			? undefined
			: () => void actions.handleDelete(item.project.path),
		onExportAnki: () => void actions.handleExportAnki(item.project.path),
		onExportCsv: () => void actions.handleExportCsv(item.project.path),
		onCreateSubProject: isVirtual
			? undefined
			: () => void actions.handleCreateSubProject(item.project.path),
		onPostpone: isVirtual
			? undefined
			: () => void actions.handlePostpone(item.project.path, item.project.name),
		onAdvance: isVirtual
			? undefined
			: () => void actions.handleAdvance(item.project.path, item.project.name),
		onReschedule: isVirtual
			? undefined
			: () =>
					void actions.handleReschedule(item.project.path, item.project.name),
		onRescheduleRecent: isVirtual
			? undefined
			: () =>
					void actions.handleRescheduleRecent(
						item.project.path,
						item.project.name,
					),
		onScheduleBreak: isVirtual
			? undefined
			: () =>
					void actions.handleScheduleBreak(
						item.project.path,
						item.project.name,
					),
		onFlatten: isVirtual
			? undefined
			: () => void actions.handleFlatten(item.project.path, item.project.name),
		onBalance: isVirtual
			? undefined
			: () => void actions.handleBalance(item.project.path, item.project.name),
		onForecast: isVirtual
			? undefined
			: () => void actions.handleForecast(item.project.path, item.project.name),
	});

	return {
		isVirtual,
		handleStudyProject,
		handleCustomStudy,
		handleContextMenu,
	};
}
