import type { IPersistence } from "../../src/interfaces/persistence";

/** In-memory filesystem implementing the IPersistence contract. */
export class MapPersistence implements IPersistence {
	files = new Map<string, Uint8Array>();
	/** When set, writeBinary stores only the first N bytes (torn write). */
	truncateWritesTo: number | null = null;

	async readBinary(path: string): Promise<Uint8Array | null> {
		return this.files.get(path) ?? null;
	}

	async read(path: string): Promise<string> {
		const data = this.files.get(path);
		if (!data) throw new Error(`Not found: ${path}`);
		return new TextDecoder().decode(data);
	}

	async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
		let bytes = new Uint8Array(data.slice(0));
		if (this.truncateWritesTo !== null) {
			bytes = bytes.slice(0, this.truncateWritesTo);
		}
		this.files.set(path, bytes);
	}

	async exists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async mkdir(): Promise<void> {}

	async list(): Promise<{ files: string[]; folders: string[] }> {
		return { files: [...this.files.keys()], folders: [] };
	}

	async remove(path: string): Promise<void> {
		this.files.delete(path);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const data = this.files.get(oldPath);
		if (!data) throw new Error(`Cannot rename missing file: ${oldPath}`);
		if (this.files.has(newPath)) {
			throw new Error(`Rename target already exists: ${newPath}`);
		}
		this.files.set(newPath, data);
		this.files.delete(oldPath);
	}

	async stat(path: string): Promise<{ size: number; mtime: number } | null> {
		const data = this.files.get(path);
		return data ? { size: data.byteLength, mtime: 0 } : null;
	}
}
