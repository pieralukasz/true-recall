import type { TypeInMode } from "./type-in-flow";

const TYPE_IN_MODE_STORAGE_KEY = "true-recall.review.type-in-mode";

interface StorageReader {
	getItem: (key: string) => string | null;
}

interface StorageWriter {
	setItem: (key: string, value: string) => void;
}

export function getTypeInModeStorage(): Storage | null {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

const VALID_MODES: ReadonlySet<string> = new Set(["off", "ai", "diff"]);

export function readPersistedTypeInMode(
	storage: StorageReader | null | undefined,
): TypeInMode | null {
	if (!storage) return null;
	try {
		const value = storage.getItem(TYPE_IN_MODE_STORAGE_KEY);
		if (value && VALID_MODES.has(value)) return value as TypeInMode;
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
