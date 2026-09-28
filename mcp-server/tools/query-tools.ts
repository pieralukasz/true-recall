import { z } from "zod";

import { get, postParams, type ToolDef } from "./_register.js";

export const queryTools: ToolDef[] = [
	postParams(
		"query_sql",
		"Run one read-only SELECT statement against the True Recall SQLite database and return columns and rows. Off by default: it fails with 403 sql-query-disabled until the user turns on Settings → True Recall → Integrations → Enable SQL query endpoint, so tell the user instead of retrying. Anything other than a single SELECT fails with 403. Use get_schema for tables and columns, and prefer the dedicated tools when one fits.",
		"/query",
		{
			sql: z.string().min(1).describe("One SQLite SELECT statement"),
		},
	),

	get(
		"get_schema",
		"Get the database schema for query_sql: tables, columns, types, row counts, and notes on FSRS fields such as what each card state number means.",
		"/schema",
	),
];
