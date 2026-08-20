/**
 * Crash-safe database file I/O.
 *
 * The database file is the only full copy of the user's review history
 * between backups. A plain write-in-place can be interrupted (plugin
 * hot-reload, app quit, process kill) and truncate the file, silently
 * destroying everything since the last backup. This module makes the write
 * atomic (tmp → verify → swap) and makes the load side salvage the newest
 * intact copy instead of falling back to a stale backup.
 */

import type { IPersistence } from "../../interfaces/persistence";

const TMP_SUFFIX = ".tmp";
const BAK_SUFFIX = ".bak";
const CORRUPTED_SUFFIX = ".corrupted";

const SQLITE_HEADER = "SQLite format 3";
const MIN_DB_FILE_BYTES = 100; // SQLite header page prefix

export function getDbTmpPath(dbPath: string): string {
	return `${dbPath}${TMP_SUFFIX}`;
}

export function getDbBakPath(dbPath: string): string {
	return `${dbPath}${BAK_SUFFIX}`;
}

export function getDbCorruptedPath(dbPath: string): string {
	return `${dbPath}${CORRUPTED_SUFFIX}`;
}

/**
 * Write `data` to `dbPath` without ever leaving a truncated main file:
 * 1. write to `<dbPath>.tmp`
 * 2. verify the bytes actually reached disk in full (torn-write guard)
 * 3. rotate the previous file to `<dbPath>.bak`
 * 4. rename `.tmp` into place
 *
 * A crash at any point leaves at least one intact copy on disk, which
 * `loadDbFileWithSalvage` picks up on the next start.
 */
export async function writeDbFileAtomically(
	persistence: IPersistence,
	dbPath: string,
	data: ArrayBuffer,
): Promise<void> {
	const tmpPath = getDbTmpPath(dbPath);
	const bakPath = getDbBakPath(dbPath);

	try {
		await persistence.writeBinary(tmpPath, data);

		const written = await persistence.stat(tmpPath);
		if (!written || written.size !== data.byteLength) {
			throw new Error(
				`Database write truncated: expected ${data.byteLength} bytes, ` +
					`found ${written?.size ?? 0}`,
			);
		}
	} catch (error) {
		// Never leave a bad .tmp behind: the load path trusts complete .tmp
		// files as the newest flush.
		await removeIfExists(persistence, tmpPath);
		throw error;
	}

	if (await persistence.exists(dbPath)) {
		await removeIfExists(persistence, bakPath);
		await persistence.rename(dbPath, bakPath);
	}
	await persistence.rename(tmpPath, dbPath);
}

export type DbLoadSource = "main" | "tmp" | "bak" | "fresh";

export interface DbLoadOutcome {
	source: DbLoadSource;
	/** True when data did not come from the main file; caller should notify and re-persist. */
	salvaged: boolean;
}

/**
 * Load the database, trying candidates newest-first:
 * `.tmp` (complete flush that missed its final rename) → main → `.bak`.
 *
 * `tryInit` must fully validate the bytes (deserialize + consistency probe)
 * and throw on corruption. On salvage, a corrupt main file is preserved as
 * `<dbPath>.corrupted` for diagnostics. Throws only when every existing
 * candidate is corrupt, so callers can fall back to archived backups.
 */
export async function loadDbFileWithSalvage(
	persistence: IPersistence,
	dbPath: string,
	tryInit: (bytes: Uint8Array | null) => Promise<void>,
): Promise<DbLoadOutcome> {
	const candidates: { source: DbLoadSource; path: string }[] = [
		{ source: "tmp", path: getDbTmpPath(dbPath) },
		{ source: "main", path: dbPath },
		{ source: "bak", path: getDbBakPath(dbPath) },
	];

	let anyCandidateExists = false;
	let mainIsCorrupt = false;
	let firstError: unknown = null;

	for (const candidate of candidates) {
		if (!(await persistence.exists(candidate.path))) continue;
		anyCandidateExists = true;

		try {
			const bytes = await readValidatedDbBytes(persistence, candidate.path);
			await tryInit(bytes);
		} catch (error) {
			firstError = firstError ?? error;
			if (candidate.source === "main") mainIsCorrupt = true;
			if (candidate.source === "tmp") {
				await removeIfExists(persistence, candidate.path);
			}
			console.error(
				`[True Recall] Database candidate unusable (${candidate.source}):`,
				error,
			);
			continue;
		}

		if (candidate.source !== "main" && mainIsCorrupt) {
			await preserveCorruptedMain(persistence, dbPath);
		}
		return { source: candidate.source, salvaged: candidate.source !== "main" };
	}

	if (!anyCandidateExists) {
		await tryInit(null);
		return { source: "fresh", salvaged: false };
	}

	throw firstError instanceof Error
		? firstError
		: new Error(`Cannot load database: ${String(firstError)}`);
}

async function readValidatedDbBytes(
	persistence: IPersistence,
	path: string,
): Promise<Uint8Array> {
	const data = await persistence.readBinary(path);
	if (!data) {
		throw new Error(`Database file unreadable: ${path}`);
	}
	if (data.byteLength < MIN_DB_FILE_BYTES) {
		throw new Error(
			`Database file too small (${data.byteLength} bytes) - likely corrupted`,
		);
	}
	const header = new TextDecoder().decode(data.slice(0, SQLITE_HEADER.length));
	if (!header.startsWith(SQLITE_HEADER)) {
		throw new Error("Invalid SQLite header - file corrupted");
	}
	return data;
}

async function preserveCorruptedMain(
	persistence: IPersistence,
	dbPath: string,
): Promise<void> {
	try {
		const corruptedPath = getDbCorruptedPath(dbPath);
		await removeIfExists(persistence, corruptedPath);
		await persistence.rename(dbPath, corruptedPath);
	} catch (error) {
		console.warn(
			"[True Recall] Could not preserve corrupted database file:",
			error,
		);
	}
}

async function removeIfExists(
	persistence: IPersistence,
	path: string,
): Promise<void> {
	if (await persistence.exists(path)) {
		await persistence.remove(path);
	}
}
