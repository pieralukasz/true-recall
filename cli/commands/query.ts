import type { CommandDef } from "../registry.js";
import { get, postParams } from "../registry.js";

const C = "Query";

export const queryCommands: CommandDef[] = [
	postParams(
		"query_sql",
		"Execute a read-only SQL SELECT query against the True Recall database",
		C,
		"/query",
		{
			sql: {
				type: "string",
				description: "SQL SELECT query to execute",
				required: true,
			},
		},
	),

	get(
		"get_schema",
		"Get database schema with table names, columns, types, row counts, and FSRS annotations",
		C,
		"/schema",
	),
];
