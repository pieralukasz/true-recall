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
	it("persists and reloads last mode", () => {
		const storage = createMemoryStorage();

		persistTypeInMode(storage, "ai");
		expect(readPersistedTypeInMode(storage)).toBe("ai");

		persistTypeInMode(storage, "diff");
		expect(readPersistedTypeInMode(storage)).toBe("diff");

		persistTypeInMode(storage, "off");
		expect(readPersistedTypeInMode(storage)).toBe("off");
	});

	it("returns null when storage is unavailable", () => {
		expect(readPersistedTypeInMode(null)).toBeNull();
		expect(readPersistedTypeInMode(undefined)).toBeNull();
	});

	it("returns null for invalid stored values", () => {
		const storage = createMemoryStorage();
		storage.setItem("true-recall.review.type-in-mode", "invalid");
		expect(readPersistedTypeInMode(storage)).toBeNull();
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

		expect(() => persistTypeInMode(failingStorage, "ai")).not.toThrow();
		expect(readPersistedTypeInMode(failingStorage)).toBeNull();
	});
});
