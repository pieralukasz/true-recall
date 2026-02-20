import type { App } from "obsidian";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";

export interface NoteEntry {
	uid: string;
	name: string;
}

export function resolveProjects(frontmatterIndex: FrontmatterIndexService): string[] {
	return [...frontmatterIndex.getAllValues("projects")].sort();
}

export function resolveNotes(app: App): NoteEntry[] {
	const notes: NoteEntry[] = [];
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const uid = cache.frontmatter.flashcard_uid as string | undefined;
		if (!uid) continue;

		notes.push({ uid, name: file.basename });
	}

	return notes.sort((a, b) => a.name.localeCompare(b.name));
}

export function downloadBlob(
	data: ArrayBuffer | string,
	filename: string,
	mimeType = "application/octet-stream",
): void {
	const blob = new Blob([data], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
