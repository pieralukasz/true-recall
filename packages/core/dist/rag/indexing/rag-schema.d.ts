import type { DatabaseLike } from "@true-recall/core/persistence/sqlite/sqlite.types";
export declare class RagSchemaManager {
    private db;
    fts5Available: boolean;
    constructor(db: DatabaseLike);
    createTables(): void;
    private createFts5;
}
