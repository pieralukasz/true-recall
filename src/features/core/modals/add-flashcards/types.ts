export type AddFlashcardsTab = "quick" | "structured";

export interface AddModalPrefs {
	activeTab: AddFlashcardsTab;
	lastNoteTypeId: string;
	lastQuickNoteTypeId: string;
}

export const ADD_MODAL_PREFS_KEY = "true-recall:add-modal-prefs";

export function loadAddModalPrefs(): AddModalPrefs {
	try {
		const raw = localStorage.getItem(ADD_MODAL_PREFS_KEY);
		if (raw) return JSON.parse(raw) as AddModalPrefs;
	} catch {
		// ignore parse errors
	}
	return {
		activeTab: "quick",
		lastNoteTypeId: "builtin-basic",
		lastQuickNoteTypeId: "builtin-basic",
	};
}

export function saveAddModalPrefs(prefs: Partial<AddModalPrefs>): void {
	const current = loadAddModalPrefs();
	localStorage.setItem(
		ADD_MODAL_PREFS_KEY,
		JSON.stringify({ ...current, ...prefs }),
	);
}
