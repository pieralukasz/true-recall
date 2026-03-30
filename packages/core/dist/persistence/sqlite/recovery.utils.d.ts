export declare function isSupportedBackupPath(path: string): boolean;
export declare function parseBackupTimestamp(path: string): number | null;
export declare function sortBackupPathsNewest(paths: string[]): string[];
export declare function decodeBackupToSqliteBytes(path: string, rawData: ArrayBuffer): Uint8Array | null;
export declare function hasSqliteHeader(bytes: Uint8Array): boolean;
export declare function toExactBackupBuffer(bytes: Uint8Array): ArrayBuffer;
