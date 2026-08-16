import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ObsidianDeviceIdStorage } from "@true-recall/obsidian/adapters/ObsidianDeviceIdStorage";

function createFakeLocalStorage(): Storage {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => data.set(key, value),
		removeItem: (key: string) => data.delete(key),
		clear: () => data.clear(),
		key: (index: number) => [...data.keys()][index] ?? null,
		get length() {
			return data.size;
		},
	} as Storage;
}

function createFakeApp(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	const app = {
		loadLocalStorage: vi.fn((key: string) => store.get(key) ?? null),
		saveLocalStorage: vi.fn((key: string, value: unknown) => {
			if (value === null) store.delete(key);
			else store.set(key, String(value));
		}),
	};
	return { app: app as unknown as App, store, mocks: app };
}

beforeEach(() => {
	Object.defineProperty(window, "localStorage", {
		value: createFakeLocalStorage(),
		configurable: true,
		writable: true,
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ObsidianDeviceIdStorage", () => {
	it("reads from vault-scoped storage first", () => {
		const { app } = createFakeApp({ "true-recall-device-id": "vaultid1" });
		window.localStorage.setItem("true-recall-device-id", "legacyid");
		const storage = new ObsidianDeviceIdStorage(app);
		expect(storage.get("true-recall-device-id")).toBe("vaultid1");
	});

	it("adopts a legacy window.localStorage value and persists it", () => {
		const { app, store } = createFakeApp();
		window.localStorage.setItem("true-recall-device-id", "legacyid");
		const storage = new ObsidianDeviceIdStorage(app);
		expect(storage.get("true-recall-device-id")).toBe("legacyid");
		expect(store.get("true-recall-device-id")).toBe("legacyid");
	});

	it("returns null when neither storage has the key", () => {
		const { app, mocks } = createFakeApp();
		const storage = new ObsidianDeviceIdStorage(app);
		expect(storage.get("true-recall-device-id")).toBeNull();
		expect(mocks.saveLocalStorage).not.toHaveBeenCalled();
	});

	it("writes through to vault-scoped storage", () => {
		const { app, store } = createFakeApp();
		const storage = new ObsidianDeviceIdStorage(app);
		storage.set("true-recall-device-id", "newid123");
		expect(store.get("true-recall-device-id")).toBe("newid123");
		storage.set("true-recall-device-id", null);
		expect(store.has("true-recall-device-id")).toBe(false);
	});
});
