import {
	decodeBackupToSqliteBytes,
	parseBackupTimestamp,
	sortBackupPathsNewest,
} from "../../../../src/features/core/persistence/sqlite/recovery.utils";
import pako from "pako";
import { describe, expect, it } from "vitest";

function makeSqliteBytes(size = 128): Uint8Array {
	const bytes = new Uint8Array(size);
	const header = new TextEncoder().encode("SQLite format 3\0");
	bytes.set(header, 0);
	return bytes;
}

describe("recovery.utils", () => {
	it("decodes .db.gz backup and validates SQLite header", () => {
		const sqlite = makeSqliteBytes();
		const gz = pako.gzip(sqlite);
		const out = decodeBackupToSqliteBytes(
			".true-recall/backups/dev/true-recall-backup-2026-03-08-101530.db.gz",
			gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
		);

		expect(out).not.toBeNull();
		expect(out && out.slice(0, 16)).toEqual(sqlite.slice(0, 16));
		expect(out?.byteLength).toBe(sqlite.byteLength);
	});

	it("sorts backups by parsed timestamp (newest first) across .db and .db.gz", () => {
		const files = [
			".true-recall/backups/dev/true-recall-backup-2026-03-07-235959.db",
			".true-recall/backups/dev/true-recall-backup-2026-03-08-000001.db.gz",
			".true-recall/backups/dev/true-recall-backup-2026-03-06-120000.db.gz",
		];

		const sorted = sortBackupPathsNewest(files);
		expect(sorted[0]).toContain("2026-03-08-000001");
		expect(sorted[1]).toContain("2026-03-07-235959");
		expect(sorted[2]).toContain("2026-03-06-120000");
	});

	it("parses timestamp for both .db and .db.gz filenames", () => {
		const dbTs = parseBackupTimestamp(
			".true-recall/backups/dev/true-recall-backup-2026-03-08-121314.db",
		);
		const gzTs = parseBackupTimestamp(
			".true-recall/backups/dev/true-recall-backup-2026-03-08-121315.db.gz",
		);
		expect(dbTs).not.toBeNull();
		expect(gzTs).not.toBeNull();
		expect((gzTs ?? 0) > (dbTs ?? 0)).toBe(true);
	});
});
