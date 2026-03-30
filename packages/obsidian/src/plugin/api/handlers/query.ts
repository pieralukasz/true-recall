import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export async function handleQuerySql(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<{ sql: string }>(raw);
	if (!body?.sql) {
		sendError(res, 400, "Body must contain { sql: string }");
		return;
	}

	const trimmedSql = body.sql.trim();
	const normalized = trimmedSql.toUpperCase();
	if (!normalized.startsWith("SELECT")) {
		sendError(res, 403, "Only SELECT queries are allowed");
		return;
	}

	// Reject multi-statement queries to prevent SQL injection via "SELECT 1; DROP TABLE ..."
	const withoutTrailingSemicolon = trimmedSql.replace(/;\s*$/, "");
	if (withoutTrailingSemicolon.includes(";")) {
		sendError(res, 403, "Multiple statements are not allowed");
		return;
	}

	try {
		const db = ctx.plugin.cardStore.getDatabase();
		const result = db.exec(trimmedSql);
		if (result.length === 0) {
			sendOk(res, { columns: [], rows: [] });
			return;
		}

		const first = result[0];
		if (!first) {
			sendOk(res, { columns: [], rows: [] });
			return;
		}

		const rows = first.values.map((row) => {
			const obj: Record<string, unknown> = {};
			first.columns.forEach((col, i) => {
				obj[col] = row[i];
			});
			return obj;
		});

		sendOk(res, { columns: first.columns, rows });
	} catch (error) {
		sendError(
			res,
			400,
			error instanceof Error ? error.message : "Query failed",
		);
	}
}

export function handleGetSchema(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const db = ctx.plugin.cardStore.getDatabase();

	const tablesResult = db.exec(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
	);
	if (tablesResult.length === 0 || !tablesResult[0]) {
		sendOk(res, { tables: [] });
		return;
	}

	const tableNames = tablesResult[0].values.map((row) => row[0] as string);

	const fsrsAnnotations: Record<string, Record<string, string>> = {
		cards: {
			state: "0=New (never due), 1=Learning, 2=Review, 3=Relearning",
			due: "ISO datetime; day-based for Review, timestamp for Learning",
			scheduled_days: "Interval in days; >= 21 = Mature card",
			stability: "FSRS retention prediction in days; low (<2.0) = problem card",
			difficulty: "FSRS difficulty (0-10 scale); higher = harder",
			lapses: "Times failed (rating=1); high (>3) = problem card",
			reps: "Total review count",
			suspended: "0=active, 1=suspended",
		},
		review_log: {
			rating: "1=Again, 2=Hard, 3=Good, 4=Easy",
		},
	};

	const tables = tableNames.map((name) => {
		const safeName = name.replace(/"/g, '""');
		const columnsResult = db.exec(`PRAGMA table_info("${safeName}")`);
		const columns =
			columnsResult[0]?.values.map((row) => {
				const colName = row[1] as string;
				const type = row[2] as string;
				const notNull = row[3] as number;
				const pk = row[5] as number;
				const annotation = fsrsAnnotations[name]?.[colName];
				return {
					name: colName,
					type,
					notNull: !!notNull,
					primaryKey: !!pk,
					...(annotation ? { annotation } : {}),
				};
			}) ?? [];

		const countResult = db.exec(`SELECT COUNT(*) FROM "${safeName}"`);
		const rowCount = (countResult[0]?.values[0]?.[0] as number) ?? 0;

		return { name, rowCount, columns };
	});

	sendOk(res, { tables });
}
