import { __awaiter } from "tslib";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleQuerySql(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!(body === null || body === void 0 ? void 0 : body.sql)) {
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
                const obj = {};
                first.columns.forEach((col, i) => {
                    obj[col] = row[i];
                });
                return obj;
            });
            sendOk(res, { columns: first.columns, rows });
        }
        catch (error) {
            sendError(res, 400, error instanceof Error ? error.message : "Query failed");
        }
    });
}
export function handleGetSchema(_req, res, ctx) {
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const db = ctx.plugin.cardStore.getDatabase();
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (tablesResult.length === 0 || !tablesResult[0]) {
        sendOk(res, { tables: [] });
        return;
    }
    const tableNames = tablesResult[0].values.map((row) => row[0]);
    const fsrsAnnotations = {
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
        var _a, _b, _c, _d, _e;
        const safeName = name.replace(/"/g, '""');
        const columnsResult = db.exec(`PRAGMA table_info("${safeName}")`);
        const columns = (_b = (_a = columnsResult[0]) === null || _a === void 0 ? void 0 : _a.values.map((row) => {
            var _a;
            const colName = row[1];
            const type = row[2];
            const notNull = row[3];
            const pk = row[5];
            const annotation = (_a = fsrsAnnotations[name]) === null || _a === void 0 ? void 0 : _a[colName];
            return Object.assign({ name: colName, type, notNull: !!notNull, primaryKey: !!pk }, (annotation ? { annotation } : {}));
        })) !== null && _b !== void 0 ? _b : [];
        const countResult = db.exec(`SELECT COUNT(*) FROM "${safeName}"`);
        const rowCount = (_e = (_d = (_c = countResult[0]) === null || _c === void 0 ? void 0 : _c.values[0]) === null || _d === void 0 ? void 0 : _d[0]) !== null && _e !== void 0 ? _e : 0;
        return { name, rowCount, columns };
    });
    sendOk(res, { tables });
}
