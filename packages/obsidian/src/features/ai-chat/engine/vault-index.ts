import { type App, getAllTags, TFile } from "obsidian";

import {
	type PreparedNote,
	prepareNote,
	type SearchableNote,
} from "./vault-search";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

interface CachedNote {
	mtime: number;
	note: PreparedNote;
}

/**
 * Note text for vault search, read once per file version. Reading 2,000 notes
 * the first time takes a moment; later searches only re-read changed files.
 */
const cache = new WeakMap<App, Map<string, CachedNote>>();

function cacheFor(app: App): Map<string, CachedNote> {
	let notes = cache.get(app);
	if (!notes) {
		notes = new Map();
		cache.set(app, notes);
	}
	return notes;
}

function frontmatterList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string" && value.trim()) return [value];
	return [];
}

export function describeFile(
	app: App,
	file: TFile,
	text: string,
): SearchableNote {
	const meta = app.metadataCache.getFileCache(file);
	return {
		path: file.path,
		title: file.basename,
		aliases: frontmatterList(meta?.frontmatter?.aliases),
		tags: meta ? [...new Set(getAllTags(meta) ?? [])] : [],
		headings: (meta?.headings ?? []).map((h) => h.heading),
		text: text.replace(FRONTMATTER_RE, ""),
		mtime: file.stat.mtime,
	};
}

export async function loadSearchableNotes(
	app: App,
	folder?: string,
): Promise<PreparedNote[]> {
	const notes = cacheFor(app);
	const prefix = folder ? `${folder.replace(/\/+$/, "")}/` : "";
	const files = app.vault
		.getMarkdownFiles()
		.filter((file) => !prefix || file.path.startsWith(prefix));
	const live = new Set(files.map((file) => file.path));
	for (const path of notes.keys()) if (!live.has(path)) notes.delete(path);
	await Promise.all(
		files.map(async (file) => {
			const hit = notes.get(file.path);
			if (hit && hit.mtime === file.stat.mtime) return;
			const text = await app.vault.cachedRead(file);
			notes.set(file.path, {
				mtime: file.stat.mtime,
				note: prepareNote(describeFile(app, file, text)),
			});
		}),
	);
	return files
		.map((file) => notes.get(file.path)?.note)
		.filter((note): note is PreparedNote => !!note);
}

/**
 * A note by exact path, by path without ".md", or by name as in a wikilink.
 * Models often pass the title they saw instead of the full path.
 */
export function resolveNoteFile(app: App, pathOrName: string): TFile | null {
	const raw = pathOrName
		.trim()
		.replace(/^\[\[|\]\]$/g, "")
		.split("|")[0]
		?.split("#")[0]
		?.trim();
	if (!raw) return null;
	for (const candidate of [raw, `${raw}.md`]) {
		const file = app.vault.getAbstractFileByPath(candidate);
		if (file instanceof TFile) return file;
	}
	return app.metadataCache.getFirstLinkpathDest(raw.replace(/\.md$/, ""), "");
}
