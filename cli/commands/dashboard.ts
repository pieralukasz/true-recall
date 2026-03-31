import type { CommandDef } from "../registry.js";
import { get, getWith } from "../registry.js";

const C = "Dashboard";

export const dashboardCommands: CommandDef[] = [
	get(
		"get_dashboard",
		"Full dashboard overview: totals, due/new/learning/overdue, today progress, streak, per-note breakdown",
		C,
		"/dashboard",
	),

	getWith(
		"get_projects",
		"Project/deck hierarchy tree with aggregate stats (excludes archived by default)",
		C,
		{
			archived: {
				type: "boolean",
				description: "Include archived projects (default: false)",
			},
		},
		(p) => (p.archived ? "/projects?archived=true" : "/projects"),
	),

	getWith(
		"get_project",
		"Detailed stats for a single project including per-note member breakdown",
		C,
		{
			path: {
				type: "string",
				description:
					"The project's vault-relative file path (e.g. 'Projects/Spanish.md')",
				required: true,
			},
		},
		(p) => `/project?path=${encodeURIComponent(String(p.path))}`,
	),
];
