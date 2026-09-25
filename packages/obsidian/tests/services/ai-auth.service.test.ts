import type { App } from "obsidian";
import { requestUrl } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIAuthService } from "@true-recall/obsidian/features/onboarding/ai-auth.service";

function createAuth() {
	const storage = new Map<string, unknown>();
	const app = {
		vault: { getName: () => "Practice Vault" },
		loadLocalStorage: (key: string) => storage.get(key),
		saveLocalStorage: (key: string, value: unknown) => storage.set(key, value),
	} as unknown as App;
	return {
		auth: new AIAuthService(app, () => ({ id: "phone", name: "Phone" })),
		storage,
	};
}
describe("AI account connection", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-22T10:00:00Z"));
		vi.mocked(requestUrl).mockReset();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});
	it("reuses the pending browser link and never puts the verifier in it", async () => {
		const { auth, storage } = createAuth();
		const url = new URL(await auth.start());
		expect(url.pathname).toBe("/auth/ai");
		expect(url.searchParams.get("vault")).toBe("Practice Vault");
		expect(url.searchParams.has("verifier")).toBe(false);
		expect(await auth.start()).toBe(url.href);
		expect(storage.has("true-recall-cloud-auth-pending")).toBe(false);
	});
	it.each([
		"wrong-state",
		"expired",
	])("rejects %s before sending credentials", async (mode) => {
		const { auth } = createAuth();
		const url = new URL(await auth.start());
		if (mode === "expired") vi.advanceTimersByTime(10 * 60_000);
		await expect(
			auth.exchange(
				"code",
				mode === "expired" ? (url.searchParams.get("state") ?? "") : "wrong",
			),
		).rejects.toThrow();
		expect(requestUrl).not.toHaveBeenCalled();
	});
	it("binds the exchange to the original PKCE challenge and never enables sync", async () => {
		const { auth, storage } = createAuth();
		const url = new URL(await auth.start());
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: { proKey: "test-key-with-enough-characters" },
		} as never);
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).resolves.toBe("test-key-with-enough-characters");
		const body = JSON.parse(
			(vi.mocked(requestUrl).mock.calls[0][0] as { body: string }).body,
		);
		expect(
			Buffer.from(
				await crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(body.verifier),
				),
			).toString("base64url"),
		).toBe(url.searchParams.get("challenge"));
		expect(body.deviceId).toBe("phone");
		expect(storage.get("true-recall-ai-auth-pending")).toBeNull();
		expect(storage.has("true-recall-cloud-session")).toBe(false);
	});
	it("rejects replay locally after successful exchange", async () => {
		const { auth } = createAuth();
		const url = new URL(await auth.start());
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			json: { proKey: "test-key-with-enough-characters" },
		} as never);
		await auth.exchange("code", url.searchParams.get("state") ?? "");
		await expect(
			auth.exchange("code", url.searchParams.get("state") ?? ""),
		).rejects.toThrow();
		expect(requestUrl).toHaveBeenCalledTimes(1);
	});
	it("does not accept a response to an older request after a new one starts", async () => {
		const { auth } = createAuth();
		const first = new URL(await auth.start());
		let release!: (value: unknown) => void;
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
		vi.advanceTimersByTime(10 * 60_000);
		await auth.start();
		release({
			status: 200,
			json: { proKey: "test-key-with-enough-characters" },
		});
		await expect(exchange).rejects.toThrow("newer AI sign-in");
	});
});
