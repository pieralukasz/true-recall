import type { App } from "obsidian";
import { requestUrl } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudAuthService } from "@true-recall/obsidian/features/integration/cloud/cloud-auth.service";

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
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
		vi.mocked(requestUrl).mockReset();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

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

	it("reopens a pending authorization without invalidating its email link", async () => {
		const { app } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const first = await auth.startAuth();
		vi.advanceTimersByTime(60_000);
		expect(await auth.startAuth(true)).toBe(first);
	});

	it("replaces an expired request when reopening the browser", async () => {
		const { app } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const first = await auth.startAuth();
		vi.advanceTimersByTime(10 * 60_000);
		expect(await auth.startAuth(true)).not.toBe(first);
	});

	it("rejects a request at its expiry boundary without making a network call", async () => {
		const { app, storage } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const url = new URL(await auth.startAuth());
		vi.advanceTimersByTime(10 * 60_000);
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).rejects.toThrow("expired");
		expect(storage.has("true-recall-cloud-auth-pending")).toBe(false);
		expect(requestUrl).not.toHaveBeenCalled();
	});

	it("sends the verifier matching the browser challenge and persists a valid session", async () => {
		const { app, storage } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const url = new URL(await auth.startAuth());
		const session = createSession();
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: session,
		} as never);
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).resolves.toEqual(session);
		const request = vi.mocked(requestUrl).mock.calls[0][0] as { body: string };
		const body = JSON.parse(request.body);
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(body.verifier),
		);
		expect(Buffer.from(digest).toString("base64url")).toBe(
			url.searchParams.get("challenge"),
		);
		expect(url.searchParams.has("verifier")).toBe(false);
		expect(body.deviceId).toBe("phone-1");
		expect(auth.getSession()).toEqual(session);
		expect(storage.has("true-recall-cloud-auth-pending")).toBe(false);
	});

	it.each([
		null,
		{},
		{ deviceToken: "short" },
		{ ...createSession(), email: "invalid" },
	])("preserves pending authorization when a response is malformed: %j", async (json) => {
		const { app, storage } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const url = new URL(await auth.startAuth());
		vi.mocked(requestUrl).mockResolvedValueOnce({ status: 200, json } as never);
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).rejects.toThrow("contract");
		expect(auth.getSession()).toBeNull();
		expect(storage.has("true-recall-cloud-auth-pending")).toBe(true);
	});

	it("allows retry after a network failure", async () => {
		const { app } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const url = new URL(await auth.startAuth());
		vi.mocked(requestUrl).mockRejectedValueOnce(new Error("offline"));
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).rejects.toThrow();
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: createSession(),
		} as never);
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).resolves.toEqual(createSession());
	});

	it("does not erase a newer pending request when an older exchange finishes", async () => {
		const { app, storage } = createApp();
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const first = new URL(await auth.startAuth());
		let release!: (response: never) => void;
		vi.mocked(requestUrl).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}) as never,
		);
		const exchange = auth.exchange(
			"code",
			first.searchParams.get("state") ?? "",
		);
		const second = new URL(await auth.startAuth());
		release({ status: 200, json: createSession() } as never);
		await expect(exchange).rejects.toThrow("older request");
		expect(storage.get("true-recall-cloud-auth-pending")).toMatchObject({
			state: second.searchParams.get("state"),
		});
		expect(auth.getSession()).toBeNull();
	});

	it("reads a legacy session when secret storage returns an empty string", () => {
		const { app, storage } = createApp();
		Object.assign(app, {
			secretStorage: { getSecret: () => "", setSecret: vi.fn() },
		});
		storage.set("true-recall-cloud-session", JSON.stringify(createSession()));
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		expect(auth.getSession()).toEqual(createSession());
	});

	it("removes the legacy credential after saving in secret storage and clears both on sign out", async () => {
		const { app, storage } = createApp();
		const secrets = new Map<string, string>();
		Object.assign(app, {
			secretStorage: {
				getSecret: (key: string) => secrets.get(key) ?? "",
				setSecret: (key: string, value: string) => secrets.set(key, value),
			},
		});
		storage.set(
			"true-recall-cloud-session",
			JSON.stringify(createSession({ deviceToken: "old".repeat(20) })),
		);
		const auth = new CloudAuthService(app, () => ({
			id: "phone-1",
			name: "Phone",
		}));
		const url = new URL(await auth.startAuth());
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: createSession(),
		} as never);
		await auth.exchange("code", url.searchParams.get("state") ?? "");
		expect(storage.has("true-recall-cloud-session")).toBe(false);
		expect(auth.getSession()).toEqual(createSession());
		auth.clearSession();
		expect(auth.getSession()).toBeNull();
	});
});

function createSession(overrides = {}) {
	return {
		deviceToken: "t".repeat(64),
		userId: "6f6f6f6f-0000-4000-8000-000000000000",
		email: "user@example.com",
		...overrides,
	};
}
