/**
 * Migrations Index
 * Re-exports all migration functions for easy importing
 *
 * Note: Old migrations (v1-v14) were removed as the project has not been released yet.
 * New installations get the v17 schema directly from createTables().
 */

export { migrate as migration015ToV16 } from "@features/core/persistence/sqlite/migrations/migration-015-to-v16.sql";
export { migrate as migration016ToV17 } from "@features/core/persistence/sqlite/migrations/migration-016-to-v17.sql";
export { migration017ToV18 } from "@features/core/persistence/sqlite/migrations/migration-017-to-v18";
export { migration018ToV19 } from "@features/core/persistence/sqlite/migrations/migration-018-to-v19";
export { migration019ToV20 } from "@features/core/persistence/sqlite/migrations/migration-019-to-v20";
export { migration020ToV21 } from "@features/core/persistence/sqlite/migrations/migration-020-to-v21";
export { migration021ToV22 } from "@features/core/persistence/sqlite/migrations/migration-021-to-v22";
