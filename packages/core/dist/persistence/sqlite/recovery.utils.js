import { toExactArrayBuffer } from "./sqlite.types";
import pako from "pako";
const BACKUP_NAME_REGEX = /^true-recall-backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.db(?:\.gz)?$/;
export function isSupportedBackupPath(path) {
    const name = path.split("/").pop() || "";
    return BACKUP_NAME_REGEX.test(name);
}
export function parseBackupTimestamp(path) {
    const name = path.split("/").pop() || "";
    const match = name.match(BACKUP_NAME_REGEX);
    if (!match)
        return null;
    const [, y, m, d, hh, mm, ss] = match;
    if (!y || !m || !d || !hh || !mm || !ss)
        return null;
    return new Date(Number.parseInt(y, 10), Number.parseInt(m, 10) - 1, Number.parseInt(d, 10), Number.parseInt(hh, 10), Number.parseInt(mm, 10), Number.parseInt(ss, 10)).getTime();
}
export function sortBackupPathsNewest(paths) {
    return [...paths].sort((a, b) => {
        var _a, _b;
        const aTs = (_a = parseBackupTimestamp(a)) !== null && _a !== void 0 ? _a : 0;
        const bTs = (_b = parseBackupTimestamp(b)) !== null && _b !== void 0 ? _b : 0;
        return bTs - aTs;
    });
}
export function decodeBackupToSqliteBytes(path, rawData) {
    try {
        const bytes = path.endsWith(".gz")
            ? pako.ungzip(new Uint8Array(rawData))
            : new Uint8Array(rawData);
        if (!hasSqliteHeader(bytes)) {
            return null;
        }
        return bytes;
    }
    catch (_a) {
        return null;
    }
}
export function hasSqliteHeader(bytes) {
    if (bytes.byteLength < 16) {
        return false;
    }
    const header = new TextDecoder().decode(bytes.slice(0, 16));
    return header.startsWith("SQLite format 3");
}
export function toExactBackupBuffer(bytes) {
    return toExactArrayBuffer(bytes);
}
