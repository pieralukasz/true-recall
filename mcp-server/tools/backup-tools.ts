import { get, post, type ToolDef } from "./_register.js";

export const backupTools: ToolDef[] = [
	post(
		"create_backup",
		"Save a compressed copy of the True Recall database now, for example before a bulk change. Backups are kept per device in .true-recall/backups.nosync/<device-id>/ and older ones are rotated out. Returns the backup path. Restoring is done by the user in Obsidian.",
		"/backups/create",
	),

	get(
		"list_backups",
		"List the database backups on this device with dates and sizes.",
		"/backups",
	),

	get(
		"check_integrity",
		"Check the database for broken links and report counts: cards without a parent note, notes without a note type, and review logs without a card. It only reports; nothing is repaired.",
		"/integrity",
	),
];
