import type { App } from "obsidian";
import { requestUrl } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { CloudAuthService } from "@true-recall/obsidian/services/cloud/cloud-auth.service";

function createApp(vaultName = "Mobile Learning") {
	const storage = new Map<string, unknown>();
	const app = {
		vault: { getName: vi.fn(() => vaultName) },
		loadLocalStorage: vi.fn((key: string) => storage.get(key) ?? null),
		saveLocalStorage: vi.fn((key: string, value: unknown) => {
			if (value === null) storage.delete(key);
			else storage.set(key, value);
		}),
	};
	return { app: app as unknown as App, storage };
}

describe("CloudAuthService", () => {
	it("binds browser authorization to the requesting vault and device", async () => {
		const { app, storage } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Łukasz iPhone",
		}));

		const url = new URL(await auth.startAuth());

		expect(url.hostname).toBe("www.truerecall.app");
		expect(url.pathname).toBe("/auth/plugin");
		expect(url.searchParams.get("device_id")).toBe("phone-1");
		expect(url.searchParams.get("device_name")).toBe("Łukasz iPhone");
		expect(url.searchParams.get("vault")).toBe("Mobile Learning");
		expect(url.searchParams.get("state")).toHaveLength(43);
		expect(url.searchParams.get("challenge")).toHaveLength(43);
		expect(storage.get("true-recall-cloud-auth-pending")).toMatchObject({
			state: url.searchParams.get("state"),
		});
	});

	it("does not clear a newer request when an older browser tab returns", async () => {
		const { app, storage } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const first = new URL(await auth.startAuth());
		const second = new URL(await auth.startAuth());

		await expect(
			auth.exchange("old-code", first.searchParams.get("state") ?? ""),
		).rejects.toThrow("older request");

		expect(storage.get("true-recall-cloud-auth-pending")).toMatchObject({
			state: second.searchParams.get("state"),
		});
		expect(requestUrl).not.toHaveBeenCalled();
	});
});
