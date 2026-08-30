import type { App } from "obsidian";

import type { TypeInMode } from "./type-in-flow";

const TYPE_IN_MODE_STORAGE_KEY = "true-recall.review.type-in-mode";

interface StorageReader {
	getItem: (key: string) => unknown;
}

interface StorageWriter {
	setItem: (key: string, value: string) => void;
}

export function getTypeInModeStorage(app: App): StorageReader & StorageWriter {
	return {
		getItem(key) {
			const value: unknown = app.loadLocalStorage(key);
			return value;
		},
		setItem(key, value) {
			app.saveLocalStorage(key, value);
		},
	};
}

const VALID_MODES: ReadonlySet<string> = new Set(["off", "ai"]);

export function readPersistedTypeInMode(
	storage: StorageReader | null | undefined,
): TypeInMode | null {
	if (!storage) return null;
	try {
		const value = storage.getItem(TYPE_IN_MODE_STORAGE_KEY);
		// Legacy value from the removed diff mode.
		if (value === "diff") return "ai";
		if (typeof value === "string" && VALID_MODES.has(value)) {
			return value as TypeInMode;
		}
		return null;
	} catch {
		return null;
	}
}

export function persistTypeInMode(
	storage: StorageWriter | null | undefined,
	mode: TypeInMode,
): void {
	if (!storage) return;
	try {
		storage.setItem(TYPE_IN_MODE_STORAGE_KEY, mode);
	} catch {
		// Ignore storage write failures (private mode / platform restrictions).
	}
}
