/**
 * CRR (Conflict-free Replicated Relations) Initializer
 *
 * Converts standard SQLite tables to CRRs using CR-SQLite's crsql_as_crr() function.
 * CRRs enable automatic CRDT-based conflict resolution for cross-device sync.
 *
 * Tables to convert:
 * - cards, source_notes, projects, note_projects
 * - review_log, daily_stats, daily_reviewed_cards, card_image_refs
 *
 * NOT converted (local-only):
 * - meta (stores schema version and local settings)
 */
import type { DatabaseLike } from "./CrSqliteLoader";

/**
 * Tables that should be converted to CRRs for sync
 * These tables contain user data that needs to be synchronized across devices
 */
export const CRR_TABLES = [
    "cards",
    "source_notes",
    "projects",
    "note_projects",
    "review_log",
    "daily_stats",
    "daily_reviewed_cards",
    "card_image_refs",
] as const;

/**
 * Tables that should NOT be converted to CRRs (local-only)
 */
export const LOCAL_ONLY_TABLES = ["meta"] as const;

/**
 * Initialize CRR tables in a CR-SQLite database
 * This should be called after schema setup when using CR-SQLite
 *
 * @param db - Database connection (must be CR-SQLite)
 * @returns Number of tables converted to CRRs
 */
export function initializeCrrs(db: DatabaseLike): number {
    let converted = 0;

    for (const table of CRR_TABLES) {
        try {
            // Check if table exists first
            const result = db.exec(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
            );
            const firstResult = result[0];

            if (!firstResult || firstResult.values.length === 0) {
                console.log(`[Episteme] CRR: Table '${table}' does not exist yet, skipping`);
                continue;
            }

            // Check if already a CRR by looking for the shadow table
            const shadowResult = db.exec(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}__crsql_clock'`
            );
            const shadowFirst = shadowResult[0];

            if (shadowFirst && shadowFirst.values.length > 0) {
                console.log(`[Episteme] CRR: Table '${table}' is already a CRR`);
                converted++;
                continue;
            }

            // Convert to CRR
            db.exec(`SELECT crsql_as_crr('${table}')`);
            console.log(`[Episteme] CRR: Converted '${table}' to CRR`);
            converted++;
        } catch (e) {
            console.warn(`[Episteme] CRR: Failed to convert '${table}' to CRR:`, e);
        }
    }

    console.log(`[Episteme] CRR: ${converted}/${CRR_TABLES.length} tables initialized as CRRs`);
    return converted;
}

/**
 * Check if CRRs are enabled on the database
 * Returns true if at least one table has been converted to CRR
 */
export function isCrrEnabled(db: DatabaseLike): boolean {
    try {
        // Check for the crsql_changes virtual table (exists if CR-SQLite is loaded)
        const result = db.exec(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='crsql_changes'"
        );
        const firstResult = result[0];
        return firstResult !== undefined && firstResult.values.length > 0;
    } catch {
        return false;
    }
}

/**
 * Get the current database version for sync
 * This is used to track which changes have been synced
 */
export function getDbVersion(db: DatabaseLike): number {
    try {
        const result = db.exec("SELECT crsql_db_version()");
        const firstResult = result[0];
        const firstRow = firstResult?.values[0];
        if (firstRow && firstRow[0] !== undefined) {
            return firstRow[0] as number;
        }
    } catch (e) {
        console.warn("[Episteme] Failed to get db_version:", e);
    }
    return 0;
}

/**
 * Get the site ID for this database instance
 * Each device has a unique site ID used to track change origins
 */
export function getSiteId(db: DatabaseLike): string | null {
    try {
        const result = db.exec("SELECT crsql_site_id()");
        const firstResult = result[0];
        const firstRow = firstResult?.values[0];
        if (firstRow) {
            const siteIdBlob = firstRow[0];
            if (siteIdBlob instanceof Uint8Array) {
                return Array.from(siteIdBlob)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }
        }
    } catch (e) {
        console.warn("[Episteme] Failed to get site_id:", e);
    }
    return null;
}

/**
 * Get changes since a specific version for syncing
 * Returns changes in a format suitable for sending to the sync server
 */
export interface CrsqlChange {
    table: string;
    pk: Uint8Array;
    cid: string;
    val: unknown;
    colVersion: number;
    dbVersion: number;
    siteId: Uint8Array;
    cl: number;
    seq: number;
}

export function getChangesSince(db: DatabaseLike, sinceVersion: number): CrsqlChange[] {
    try {
        const result = db.exec(
            `SELECT "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
             FROM crsql_changes
             WHERE db_version > ${sinceVersion}`
        );

        const firstResult = result[0];
        if (!firstResult || firstResult.values.length === 0) {
            return [];
        }

        return firstResult.values.map((row) => ({
            table: row[0] as string,
            pk: row[1] as Uint8Array,
            cid: row[2] as string,
            val: row[3],
            colVersion: row[4] as number,
            dbVersion: row[5] as number,
            siteId: row[6] as Uint8Array,
            cl: row[7] as number,
            seq: row[8] as number,
        }));
    } catch (e) {
        console.warn("[Episteme] Failed to get changes:", e);
        return [];
    }
}

/**
 * Apply changes from another device
 * Used during sync to merge changes from the server
 */
export function applyChanges(db: DatabaseLike, changes: CrsqlChange[]): number {
    let applied = 0;

    for (const change of changes) {
        try {
            // Convert Uint8Array values to proper format for SQL
            const pkHex = bufferToHex(change.pk);
            const siteIdHex = bufferToHex(change.siteId);
            const valStr = serializeValue(change.val);

            db.exec(
                `INSERT INTO crsql_changes ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
                 VALUES ('${change.table}', X'${pkHex}', '${change.cid}', ${valStr}, ${change.colVersion}, ${change.dbVersion}, X'${siteIdHex}', ${change.cl}, ${change.seq})`
            );
            applied++;
        } catch (e) {
            console.warn("[Episteme] Failed to apply change:", e, change);
        }
    }

    return applied;
}

/**
 * Convert Uint8Array to hex string for SQL
 */
function bufferToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Serialize a value for SQL insertion
 */
function serializeValue(val: unknown): string {
    if (val === null || val === undefined) {
        return "NULL";
    }
    if (typeof val === "number") {
        return String(val);
    }
    if (typeof val === "string") {
        // Escape single quotes
        return `'${val.replace(/'/g, "''")}'`;
    }
    if (val instanceof Uint8Array) {
        return `X'${bufferToHex(val)}'`;
    }
    // For other types, try JSON
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
}
