import { describe, expect, it } from "vitest";

import { UNASSIGNED_PATH } from "@true-recall/core/constants";
import type { DashboardProject } from "@true-recall/core/types/dashboard.types";

import { buildProjectCustomStudyScope } from "@true-recall/obsidian/features/study/ui/dashboard/helpers/custom-study-scope";

function project(overrides: Partial<DashboardProject> = {}): DashboardProject {
	return {
		name: "Electrics",
		path: "Electrics/Electrics.md",
		healthPct: 0,
		newCount: 0,
		learning: 0,
		due: 0,
		totalCards: 0,
		childCount: 2,
		lastReviewed: null,
		totalMembers: 3,
		memberNotes: [],
		children: [],
		...overrides,
	};
}

describe("buildProjectCustomStudyScope", () => {
	it("uses the project path instead of only direct member notes", () => {
		expect(
			buildProjectCustomStudyScope(
				project({
					memberNotes: [
						{
							name: "Direct note only",
						} as DashboardProject["memberNotes"][number],
					],
				}),
			),
		).toEqual({
			projectPath: "Electrics/Electrics.md",
			scopeLabel: "Electrics",
		});
	});

	it("uses note names for the virtual Unassigned project", () => {
		expect(
			buildProjectCustomStudyScope(
				project({
					name: "Unassigned",
					path: UNASSIGNED_PATH,
					memberNotes: [
						{ name: "One" },
						{ name: "Two" },
					] as DashboardProject["memberNotes"],
				}),
			),
		).toEqual({
			sourceNoteFilters: ["One", "Two"],
			scopeLabel: "Unassigned",
		});
	});
});
