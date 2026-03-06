/**
 * Import Studio types.
 */

export interface ImportStudioPrefs {
	lastNoteTypeId: string;
	lastSourceNotePath: string;
}

export const IMPORT_STUDIO_PREFS_KEY = "true-recall:import-studio-prefs";

export function loadImportStudioPrefs(): ImportStudioPrefs {
	try {
		const raw = localStorage.getItem(IMPORT_STUDIO_PREFS_KEY);
		if (raw) return JSON.parse(raw) as ImportStudioPrefs;
	} catch {
		// ignore
	}
	return {
		lastNoteTypeId: "builtin-basic",
		lastSourceNotePath: "",
	};
}

export function saveImportStudioPrefs(prefs: Partial<ImportStudioPrefs>): void {
	const current = loadImportStudioPrefs();
	localStorage.setItem(
		IMPORT_STUDIO_PREFS_KEY,
		JSON.stringify({ ...current, ...prefs }),
	);
}
