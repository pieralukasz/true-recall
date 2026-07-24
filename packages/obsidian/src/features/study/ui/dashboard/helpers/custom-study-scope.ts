import { UNASSIGNED_PATH } from "@true-recall/core/constants";
import type { DashboardProject } from "@true-recall/core/types/dashboard.types";

import type { CustomStudyModalScope } from "@true-recall/obsidian/modals/study/CustomStudyModal";

/**
 * Real projects stay path-scoped so HierarchyService includes descendants.
 * Unassigned is virtual, so it falls back to an explicit note-name list.
 */
export function buildProjectCustomStudyScope(
	project: DashboardProject,
): CustomStudyModalScope {
	if (project.path === UNASSIGNED_PATH) {
		return {
			sourceNoteFilters: project.memberNotes.map((note) => note.name),
			scopeLabel: "Unassigned",
		};
	}

	return {
		projectPath: project.path,
		scopeLabel: project.name,
	};
}
