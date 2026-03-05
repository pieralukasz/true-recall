import { describe, expect, it } from "vitest";
import {
	persistTypeInMode,
	readPersistedTypeInMode,
} from "../../../src/features/study/ui/review/helpers/type-in-storage";

function createMemoryStorage() {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
	};
}

describe("type-in mode storage", () => {
	it("persists and reloads last toggle state", () => {
		const storage = createMemoryStorage();

		persistTypeInMode(storage, true);
		expect(readPersistedTypeInMode(storage)).toBe(true);

		// Simulate restart: read from same backing storage
		expect(readPersistedTypeInMode(storage)).toBe(true);

		persistTypeInMode(storage, false);
		expect(readPersistedTypeInMode(storage)).toBe(false);
	});

	it("falls back to false when storage is unavailable", () => {
		expect(readPersistedTypeInMode(null)).toBe(false);
		expect(readPersistedTypeInMode(undefined)).toBe(false);
	});

	it("ignores storage errors", () => {
		const failingStorage = {
			getItem: () => {
				throw new Error("denied");
			},
			setItem: () => {
				throw new Error("denied");
			},
		};

		expect(() => persistTypeInMode(failingStorage, true)).not.toThrow();
		expect(readPersistedTypeInMode(failingStorage)).toBe(false);
	});
});

