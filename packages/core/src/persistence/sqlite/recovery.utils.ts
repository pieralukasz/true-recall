import pako from "pako";

import { toExactArrayBuffer } from "./sqlite.types";

const BACKUP_NAME_REGEX =
	/^true-recall-backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.db(?:\.gz)?$/;

export function isSupportedBackupPath(path: string): boolean {
	const name = path.split("/").pop() || "";
	return BACKUP_NAME_REGEX.test(name);
}

export function parseBackupTimestamp(path: string): number | null {
	const name = path.split("/").pop() || "";
	const match = name.match(BACKUP_NAME_REGEX);
	if (!match) return null;

	const [, y, m, d, hh, mm, ss] = match;
	if (!y || !m || !d || !hh || !mm || !ss) return null;

	return new Date(
		Number.parseInt(y, 10),
		Number.parseInt(m, 10) - 1,
		Number.parseInt(d, 10),
		Number.parseInt(hh, 10),
		Number.parseInt(mm, 10),
		Number.parseInt(ss, 10),
	).getTime();
}

export function sortBackupPathsNewest(paths: string[]): string[] {
	return [...paths].sort((a, b) => {
		const aTs = parseBackupTimestamp(a) ?? 0;
		const bTs = parseBackupTimestamp(b) ?? 0;
		return bTs - aTs;
	});
}

export function decodeBackupToSqliteBytes(
	path: string,
	rawData: ArrayBuffer,
): Uint8Array | null {
	try {
		const bytes = path.endsWith(".gz")
			? pako.ungzip(new Uint8Array(rawData))
			: new Uint8Array(rawData);
		if (!hasSqliteHeader(bytes)) {
			return null;
		}
		return bytes;
	} catch {
		return null;
	}
}

function hasSqliteHeader(bytes: Uint8Array): boolean {
	if (bytes.byteLength < 16) {
		return false;
	}
	const header = new TextDecoder().decode(bytes.slice(0, 16));
	return header.startsWith("SQLite format 3");
}

export function toExactBackupBuffer(bytes: Uint8Array): ArrayBuffer {
	return toExactArrayBuffer(bytes);
}
