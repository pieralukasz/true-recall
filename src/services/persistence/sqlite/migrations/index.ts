/**
 * Migrations Index
 * Re-exports all migration functions for easy importing
 *
 * Note: Old migrations (v1-v14) were removed as the project has not been released yet.
 * New installations get the v17 schema directly from createTables().
 */

export { migrate as migration015ToV16 } from "./migration-015-to-v16.sql";
export { migrate as migration016ToV17 } from "./migration-016-to-v17.sql";
