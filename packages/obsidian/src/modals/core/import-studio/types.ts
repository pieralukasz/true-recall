/**
 * Import Studio types.
 */

import type { App } from "obsidian";

export interface ImportStudioPrefs {
	lastNoteTypeId: string;
	lastSourceNotePath: string;
}

export const IMPORT_STUDIO_PREFS_KEY = "true-recall:import-studio-prefs";

export function loadImportStudioPrefs(app: App): ImportStudioPrefs {
	try {
		const raw = app.loadLocalStorage(IMPORT_STUDIO_PREFS_KEY);
		if (raw) return JSON.parse(raw) as ImportStudioPrefs;
	} catch {
		// ignore
	}
	return {
		lastNoteTypeId: "builtin-basic",
		lastSourceNotePath: "",
	};
}

export function saveImportStudioPrefs(
	app: App,
	prefs: Partial<ImportStudioPrefs>,
): void {
	const current = loadImportStudioPrefs(app);
	app.saveLocalStorage(
		IMPORT_STUDIO_PREFS_KEY,
		JSON.stringify({ ...current, ...prefs }),
	);
}
