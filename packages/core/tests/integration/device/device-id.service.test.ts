import { describe, expect, it, vi } from "vitest";

import {
	DeviceIdService,
	type DeviceIdStorage,
	isValidDeviceId,
} from "../../../src/integration/device/device-id.service";

function createMemoryStorage(
	initial: Record<string, string> = {},
): DeviceIdStorage & { data: Map<string, string> } {
	const data = new Map(Object.entries(initial));
	return {
		data,
		get: (key) => data.get(key) ?? null,
		set: (key, value) => {
			if (value === null) data.delete(key);
			else data.set(key, value);
		},
	};
}

describe("DeviceIdService", () => {
	describe("device id resolution", () => {
		it("uses an existing valid id from storage", () => {
			const storage = createMemoryStorage({
				"true-recall-device-id": "abcd1234",
			});
			const service = new DeviceIdService(storage);
			expect(service.getDeviceId()).toBe("abcd1234");
		});

		it("mints and persists a fresh id when storage is empty", () => {
			const storage = createMemoryStorage();
			const service = new DeviceIdService(storage);
			const id = service.getDeviceId();
			expect(isValidDeviceId(id)).toBe(true);
			expect(storage.data.get("true-recall-device-id")).toBe(id);
		});

		it("replaces an invalid stored id with a fresh one", () => {
			const storage = createMemoryStorage({
				"true-recall-device-id": "NOT VALID!",
			});
			const service = new DeviceIdService(storage);
			const id = service.getDeviceId();
			expect(isValidDeviceId(id)).toBe(true);
			expect(id).not.toBe("NOT VALID!");
		});

		it("falls back to an ephemeral id when storage writes fail", () => {
			const spy = vi.spyOn(console, "error").mockImplementation(() => {});
			const storage: DeviceIdStorage = {
				get: () => null,
				set: () => {
					throw new Error("storage unavailable");
				},
			};
			const service = new DeviceIdService(storage);
			expect(isValidDeviceId(service.getDeviceId())).toBe(true);
			spy.mockRestore();
		});
	});

	describe("device label", () => {
		it("stores and returns a trimmed label", () => {
			const storage = createMemoryStorage();
			const service = new DeviceIdService(storage);
			service.setDeviceLabel("  My Phone  ");
			expect(service.getDeviceLabel()).toBe("My Phone");
			expect(service.getDisplayName()).toBe("My Phone");
			expect(storage.data.get("true-recall-device-label")).toBe("My Phone");
		});

		it("clears the label when set to whitespace", () => {
			const storage = createMemoryStorage({
				"true-recall-device-label": "Old",
			});
			const service = new DeviceIdService(storage);
			service.setDeviceLabel("   ");
			expect(service.getDeviceLabel()).toBeNull();
			expect(service.getDisplayName()).toBe(service.getDeviceId());
			expect(storage.data.has("true-recall-device-label")).toBe(false);
		});
	});
});
