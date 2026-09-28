import { z } from "zod";

import { get, getWith, type ToolDef } from "./_register.js";

export const dashboardTools: ToolDef[] = [
	get(
		"get_dashboard",
		"Get the dashboard numbers: total cards, due/new/learning/overdue counts, today's progress against the daily limits, streak, estimated study time, a per-note breakdown with priority, and cards without a source note.",
		"/dashboard",
	),

	getWith(
		"get_projects",
		"Get the project (deck) tree with card counts per project: total, due, new, learning, overdue. Archived projects are left out unless archived is true. Use get_project with a project's path for its per-note breakdown.",
		{
			archived: z
				.boolean()
				.optional()
				.describe("Include archived projects (default: false)"),
		},
		(p) => (p.archived ? "/projects?archived=true" : "/projects"),
	),

	getWith(
		"get_project",
		"Get one project's stats with a per-note breakdown (name, path, due, new, learning, total, overdue days). Fails with 404 for an unknown path; get_projects lists the paths.",
		{
			path: z
				.string()
				.describe(
					"The project's vault-relative file path (e.g. 'Projects/Spanish.md'). Get this from the get_projects response.",
				),
		},
		(p) => `/project?path=${encodeURIComponent(String(p.path))}`,
	),
];
