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

export function readPersistedTypeInMode(
	storage: StorageReader | null | undefined,
): boolean {
	if (!storage) return false;
	try {
		return storage.getItem(TYPE_IN_MODE_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

export function persistTypeInMode(
	storage: StorageWriter | null | undefined,
	enabled: boolean,
): void {
	if (!storage) return;
	try {
		storage.setItem(TYPE_IN_MODE_STORAGE_KEY, String(enabled));
	} catch {
		// Ignore storage write failures (private mode / platform restrictions).
	}
}

