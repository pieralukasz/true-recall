import { requestUrl } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CloudAuthService } from "@true-recall/obsidian/services/cloud/cloud-auth.service";
import { CloudSyncApiClient } from "@true-recall/obsidian/services/cloud/cloud-sync-api.client";

const requestUrlMock = vi.mocked(requestUrl);

function createAuth() {
	return {
		getSession: vi.fn(() => ({
			deviceToken: "t".repeat(48),
			userId: "6f6f6f6f-0000-4000-8000-000000000000",
			email: "lucas@example.com",
		})),
		clearSession: vi.fn(),
	} as unknown as CloudAuthService & {
		getSession: ReturnType<typeof vi.fn>;
		clearSession: ReturnType<typeof vi.fn>;
	};
}

describe("CloudSyncApiClient", () => {
	beforeEach(() => {
		requestUrlMock.mockReset();
	});

	it("clears the session and signals auth expiry on 401", async () => {
		const auth = createAuth();
		const onAuthExpired = vi.fn();
		requestUrlMock.mockResolvedValueOnce({
			status: 401,
			json: { error: "Unauthorized" },
		} as never);
		const client = new CloudSyncApiClient(auth, onAuthExpired);

		await expect(client.exchange({ cursor: 0, changes: [] })).rejects.toThrow(
			"expired",
		);

		expect(auth.clearSession).toHaveBeenCalledOnce();
		expect(onAuthExpired).toHaveBeenCalledOnce();
	});

	it("reports a failed revocation instead of swallowing it", async () => {
		const auth = createAuth();
		requestUrlMock.mockResolvedValueOnce({
			status: 500,
			json: { error: "Could not revoke device" },
		} as never);

		await expect(new CloudSyncApiClient(auth).revoke()).resolves.toBe(false);
	});

	it("treats an already-invalid token as a successful revocation", async () => {
		const auth = createAuth();
		requestUrlMock.mockResolvedValueOnce({
			status: 401,
			json: { error: "Unauthorized" },
		} as never);

		await expect(new CloudSyncApiClient(auth).revoke()).resolves.toBe(true);
	});

	it("confirms a successful revocation", async () => {
		const auth = createAuth();
		requestUrlMock.mockResolvedValueOnce({
			status: 200,
			json: { ok: true },
		} as never);

		await expect(new CloudSyncApiClient(auth).revoke()).resolves.toBe(true);
	});
});
