import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudSyncManager } from "@true-recall/obsidian/features/integration/cloud/cloud-sync-manager";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

const notifications = vi.hoisted(() => ({
	success: vi.fn(),
	info: vi.fn(),
	error: vi.fn(),
	operationFailed: vi.fn(),
}));
vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => notifications,
}));

function createPlugin() {
	return {
		app: {
			loadLocalStorage: vi.fn(),
			workspace: { onLayoutReady: vi.fn() },
		},
		settings: { syncMode: "off" },
		registerObsidianProtocolHandler: vi.fn(),
		registerInterval: vi.fn(),
		registerDomEvent: vi.fn(),
		register: vi.fn(),
		coreApp: { events: { onAny: vi.fn() } },
		saveSettings: vi.fn().mockResolvedValue(undefined),
		teardownSharedVaultSync: vi.fn(),
	};
}

describe("Cloud Sync sign-in callbacks", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
		vi.clearAllMocks();
		vi.stubGlobal("open", vi.fn());
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("reuses pending authorization only while waiting for the browser", async () => {
		const manager = new CloudSyncManager(
			createPlugin() as unknown as TrueRecallPlugin,
		);
		const start = vi
			.spyOn(manager.auth, "startAuth")
			.mockResolvedValue("https://example.invalid/auth");
		await manager.beginSignIn();
		expect(start).toHaveBeenLastCalledWith(false);
		await manager.beginSignIn();
		expect(start).toHaveBeenLastCalledWith(true);
		manager.authState.value = "error";
		await manager.beginSignIn();
		expect(start).toHaveBeenLastCalledWith(false);
	});

	it("exchanges an automatic callback and repeated fallback click only once", async () => {
		const plugin = createPlugin();
		const manager = new CloudSyncManager(plugin as unknown as TrueRecallPlugin);
		manager.initialize();
		const callback = plugin.registerObsidianProtocolHandler.mock.calls[0][1];
		const session = {
			deviceToken: "t".repeat(64),
			userId: "user-1",
			email: "user@example.com",
		};
		let release!: (value: typeof session) => void;
		const exchange = vi.spyOn(manager.auth, "exchange").mockImplementation(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
		vi.spyOn(manager.auth, "getSession").mockReturnValue(session);
		const sync = vi
			.spyOn(manager.coordinator, "syncNow")
			.mockResolvedValue(undefined as never);
		callback({ code: "code", state: "state" });
		callback({ code: "code", state: "state" });
		expect(exchange).toHaveBeenCalledOnce();
		release(session);
		await vi.waitFor(() => expect(manager.authState.value).toBe("idle"));
		callback({ code: "code", state: "state" });
		expect(exchange).toHaveBeenCalledOnce();
		expect(plugin.saveSettings).toHaveBeenCalledOnce();
		expect(sync).toHaveBeenCalledOnce();
		expect(notifications.operationFailed).not.toHaveBeenCalled();
		expect(manager.accountEmail.value).toBe(session.email);
	});

	it("allows a callback to be retried after a failed exchange", async () => {
		const plugin = createPlugin();
		const manager = new CloudSyncManager(plugin as unknown as TrueRecallPlugin);
		manager.initialize();
		const callback = plugin.registerObsidianProtocolHandler.mock.calls[0][1];
		const exchange = vi
			.spyOn(manager.auth, "exchange")
			.mockRejectedValue(new Error("offline"));
		callback({ code: "code", state: "state" });
		await vi.waitFor(() => expect(manager.authState.value).toBe("error"));
		callback({ code: "code", state: "state" });
		await vi.waitFor(() => expect(exchange).toHaveBeenCalledTimes(2));
	});
});
