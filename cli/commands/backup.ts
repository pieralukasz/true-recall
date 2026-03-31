import type { CommandDef } from "../registry.js";
import { get, post } from "../registry.js";

const C = "Backup";

export const backupCommands: CommandDef[] = [
	post(
		"create_backup",
		"Create a compressed backup of the True Recall database",
		C,
		"/backups/create",
	),

	get(
		"list_backups",
		"List all available database backups with dates and sizes",
		C,
		"/backups",
	),

	get(
		"check_integrity",
		"Run database integrity check. Reports orphaned cards, notes, and review logs.",
		C,
		"/integrity",
	),
];
