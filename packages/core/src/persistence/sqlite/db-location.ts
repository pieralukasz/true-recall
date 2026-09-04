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
import {
	getDbBakPath,
	getDbTmpPath,
	MIN_DB_FILE_BYTES,
} from "./atomic-db-file";
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
 * - Only the other folder has it: copy main, then `.tmp` (newest interrupted
 *   flush) and `.bak` best-effort, and delete each original only after its
 *   copy is verified. A failed main copy leaves everything in place and
 *   returns the other folder, so a stubborn filesystem degrades to today's
 *   behavior instead of an empty database.
 * - Neither has it: return the target; the store creates a fresh file there.
 *
 * The move is a copy, never a rename. On iOS a file iCloud has evicted is only
 * a placeholder; renaming that placeholder into a `.nosync` folder strands it
 * where iCloud can no longer fetch its bytes and the next load finds nothing
 * usable. Reading the file forces the download first, and a placeholder that
 * cannot be downloaded right now stays where it is.
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
		await copyDbFile(persistence, otherPath, targetPath);
	} catch (error) {
		await removeIfExists(persistence, targetPath);
		console.error(
			`[True Recall] Could not move database from ${otherFolder} to ${targetFolder}:`,
			error,
		);
		return otherFolder;
	}

	await moveIfExists(
		persistence,
		getDbTmpPath(otherPath),
		getDbTmpPath(targetPath),
	);
	await moveIfExists(
		persistence,
		getDbBakPath(otherPath),
		getDbBakPath(targetPath),
	);
	await removeIfExists(persistence, otherPath);
	console.info(
		`[True Recall] Database moved from ${otherFolder} to ${targetFolder}`,
	);
	return targetFolder;
}

/** Read, write, and verify; throws before anything is deleted. */
async function copyDbFile(
	persistence: IPersistence,
	from: string,
	to: string,
): Promise<void> {
	const data = await persistence.readBinary(from);
	if (!data || data.byteLength < MIN_DB_FILE_BYTES) {
		throw new Error(
			`Database file unreadable or truncated (${data?.byteLength ?? 0} bytes): ${from}`,
		);
	}
	const buffer =
		data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
			? (data.buffer as ArrayBuffer)
			: (data.slice().buffer as ArrayBuffer);
	await persistence.writeBinary(to, buffer);
	const written = await persistence.stat(to);
	if (!written || written.size !== data.byteLength) {
		throw new Error(
			`Copy of ${from} is incomplete: expected ${data.byteLength} bytes, found ${written?.size ?? "none"}`,
		);
	}
}

/** Best-effort sibling move: copy, verify, delete the original; on failure keep it. */
async function moveIfExists(
	persistence: IPersistence,
	from: string,
	to: string,
): Promise<void> {
	try {
		if (!(await persistence.exists(from))) return;
		await copyDbFile(persistence, from, to);
		await persistence.remove(from);
	} catch (error) {
		await removeIfExists(persistence, to);
		console.warn(`[True Recall] Could not move ${from} to ${to}:`, error);
	}
}

async function removeIfExists(
	persistence: IPersistence,
	path: string,
): Promise<void> {
	try {
		if (await persistence.exists(path)) await persistence.remove(path);
	} catch (error) {
		console.warn(`[True Recall] Could not remove ${path}:`, error);
	}
}
