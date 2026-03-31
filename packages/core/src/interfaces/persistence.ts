/**
 * Platform adapter for binary file I/O (database, backups).
 * Obsidian: wraps app.vault.adapter
 * Desktop: wraps fs/promises
 */
export interface IPersistence {
	readBinary(path: string): Promise<Uint8Array | null>;
	read(path: string): Promise<string>;
	writeBinary(path: string, data: ArrayBuffer): Promise<void>;
	exists(path: string): Promise<boolean>;
	mkdir(path: string): Promise<void>;
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
	remove(path: string): Promise<void>;
	stat(path: string): Promise<{ size: number; mtime: number } | null>;
}
