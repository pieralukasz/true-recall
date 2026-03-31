import type { SqliteDatabase } from "../../persistence/sqlite/SqliteDatabase";
export interface IntegrityReport {
    orphanedCards: string[];
    orphanedNotes: string[];
    orphanedReviewLogs: string[];
    totalIssues: number;
}
export declare class IntegrityCheckService {
    private db;
    constructor(db: SqliteDatabase);
    check(): IntegrityReport;
    repair(report: IntegrityReport): number;
    /**
     * Run check + repair on first load only (idempotent via meta key).
     * Returns number of issues fixed, or 0 if already checked.
     */
    checkAndRepairOnce(): number;
}
