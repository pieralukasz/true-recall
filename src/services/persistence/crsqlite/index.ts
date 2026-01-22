/**
 * CR-SQLite Module
 * Provides CRDT-based SQLite for cross-device synchronization
 */

export {
    loadDatabase,
    isCrSqliteAvailable,
    disableCrSqlite,
    resetLoaderState,
    type BindParams,
    type DatabaseLike,
    type DatabaseLoadResult,
    type QueryExecResult,
} from "./CrSqliteLoader";

export {
    initializeCrrs,
    isCrrEnabled,
    getDbVersion,
    getSiteId,
    getChangesSince,
    applyChanges,
    CRR_TABLES,
    LOCAL_ONLY_TABLES,
    type CrsqlChange,
} from "./CrrInitializer";
