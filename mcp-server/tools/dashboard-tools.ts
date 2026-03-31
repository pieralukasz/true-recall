import { z } from "zod";
import { get, getWith, type ToolDef } from "./_register.js";

export const dashboardTools: ToolDef[] = [
	get(
		"get_dashboard",
		"Get a full dashboard overview: total cards, due/new/learning/overdue counts, today's progress (studied, time, new vs review caps), streak, estimated study time, per-note breakdown with priority, and orphaned card stats.",
		"/dashboard",
	),

	getWith(
		"get_projects",
		"Get the project/deck hierarchy tree with aggregate stats (total cards, due, new, learning, overdue counts per project). Excludes archived projects by default. Returns summary without per-note member details. Use get_project for a detailed breakdown of a specific project.",
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
		"Get detailed stats for a single project including per-note member breakdown (name, path, due, new, learning, total cards, overdue days). Use get_projects first to discover project paths.",
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
