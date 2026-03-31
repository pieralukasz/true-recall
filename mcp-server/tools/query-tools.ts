import { z } from "zod";
import { get, postParams, type ToolDef } from "./_register.js";

export const queryTools: ToolDef[] = [
	postParams(
		"query_sql",
		"Execute a read-only SQL SELECT query against the True Recall database. Only SELECT queries are allowed. Use get_schema first to understand the database structure.",
		"/query",
		{
			sql: z.string().describe("SQL SELECT query to execute"),
		},
	),

	get(
		"get_schema",
		"Get the database schema with table names, columns, types, row counts, and FSRS-specific annotations (what card states mean, how to identify problem cards, etc.)",
		"/schema",
	),
];
