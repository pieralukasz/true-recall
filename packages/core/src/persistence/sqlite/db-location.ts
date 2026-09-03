/**
 * Where the per-device SQLite file lives.
 *
 * In `shared-vault` mode other devices read this file straight out of the
 * vault, so it must sit in the synced `.true-recall/` folder. In `cloud` and
 * `off` modes nothing else ever reads it, and keeping a 60 MB file that is
 * rewritten in full on every flush inside iCloud Drive costs a full upload
 * per flush, produces conflict copies, and lets iOS evict the file so the
 * next launch downloads it inside `onload`. iCloud skips any path containing
 * a `.nosync` component (the same mechanism keeps `backups.nosync` local).
 */
import type { IPersistence } from "../../interfaces/persistence";
import { getDbBakPath, getDbTmpPath } from "./atomic-db-file";
import { DB_FOLDER, getDeviceDbFilename } from "./sqlite.types";

export const LOCAL_DB_FOLDER = `${DB_FOLDER}/local.nosync`;

export type DbLocation = "shared" | "local";

export type SyncMode = "off" | "cloud" | "shared-vault";

export function resolveDbLocation(syncMode: SyncMode): DbLocation {
	return syncMode === "shared-vault" ? "shared" : "local";
}

export function getDbFolder(location: DbLocation): string {
	return location === "shared" ? DB_FOLDER : LOCAL_DB_FOLDER;
}

export function getDeviceDbPath(deviceId: string, folder: string): string {
	return `${folder}/${getDeviceDbFilename(deviceId)}`;
}

/** Create each missing segment of `folder` in order; adapters need not create parents. */
export async function ensureFolder(
	persistence: IPersistence,
	folder: string,
): Promise<void> {
	const segments = folder.split("/").filter(Boolean);
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!(await persistence.exists(current))) {
			await persistence.mkdir(current);
		}
	}
}

/**
 * Move the device database into the folder its sync mode requires and return
 * the folder the store must use for this session.
 *
 * - Target already has the file: return the target, touch nothing.
 * - Only the other folder has it: move `.tmp` (newest interrupted flush),
 *   main, then `.bak`. Sibling moves are best-effort; a failed main move
 *   leaves everything in place and returns the other folder, so a stubborn
 *   filesystem degrades to today's behavior instead of an empty database.
 * - Neither has it: return the target; the store creates a fresh file there.
 */
export async function migrateDeviceDbLocation(
	persistence: IPersistence,
	deviceId: string,
	target: DbLocation,
): Promise<string> {
	const targetFolder = getDbFolder(target);
	const otherFolder = getDbFolder(target === "shared" ? "local" : "shared");
	const targetPath = getDeviceDbPath(deviceId, targetFolder);
	const otherPath = getDeviceDbPath(deviceId, otherFolder);

	if (await persistence.exists(targetPath)) return targetFolder;
	if (!(await persistence.exists(otherPath))) return targetFolder;

	try {
		await ensureFolder(persistence, targetFolder);
		await moveIfExists(
			persistence,
			getDbTmpPath(otherPath),
			getDbTmpPath(targetPath),
		);
		await persistence.rename(otherPath, targetPath);
	} catch (error) {
		console.error(
			`[True Recall] Could not move database from ${otherFolder} to ${targetFolder}:`,
			error,
		);
		return otherFolder;
	}

	await moveIfExists(
		persistence,
		getDbBakPath(otherPath),
		getDbBakPath(targetPath),
	);
	console.info(
		`[True Recall] Database moved from ${otherFolder} to ${targetFolder}`,
	);
	return targetFolder;
}

async function moveIfExists(
	persistence: IPersistence,
	from: string,
	to: string,
): Promise<void> {
	try {
		if (await persistence.exists(from)) {
			await persistence.rename(from, to);
		}
	} catch (error) {
		console.warn(`[True Recall] Could not move ${from} to ${to}:`, error);
	}
}
