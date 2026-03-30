import { get, post, type ToolDef } from "./_register.js";

export const backupTools: ToolDef[] = [
	post(
		"create_backup",
		"Create a compressed backup of the True Recall database. Backups are stored in .true-recall/backups/.",
		"/backups/create",
	),

	get(
		"list_backups",
		"List all available database backups with dates and sizes.",
		"/backups",
	),

	get(
		"check_integrity",
		"Run a database integrity check. Reports orphaned cards (no parent note), orphaned notes (no note type), and orphaned review logs (no parent card).",
		"/integrity",
	),
];
