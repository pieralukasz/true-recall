import type { IPersistence } from "@true-recall/core";
import { type App, normalizePath } from "obsidian";

export class ObsidianPersistence implements IPersistence {
	constructor(private app: App) {}

	async readBinary(path: string): Promise<Uint8Array | null> {
		const normalized = normalizePath(path);
		if (!(await this.app.vault.adapter.exists(normalized))) return null;
		const buffer = await this.app.vault.adapter.readBinary(normalized);
		return new Uint8Array(buffer);
	}

	async read(path: string): Promise<string> {
		return this.app.vault.adapter.read(normalizePath(path));
	}

	async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
		await this.app.vault.adapter.writeBinary(normalizePath(path), data);
	}

	async exists(path: string): Promise<boolean> {
		return this.app.vault.adapter.exists(normalizePath(path));
	}

	async mkdir(path: string): Promise<void> {
		await this.app.vault.adapter.mkdir(normalizePath(path));
	}

	async list(path: string): Promise<{ files: string[]; folders: string[] }> {
		return this.app.vault.adapter.list(normalizePath(path));
	}

	async remove(path: string): Promise<void> {
		await this.app.vault.adapter.remove(normalizePath(path));
	}

	async stat(path: string): Promise<{ size: number; mtime: number } | null> {
		const s = await this.app.vault.adapter.stat(normalizePath(path));
		return s ? { size: s.size, mtime: s.mtime } : null;
	}
}
