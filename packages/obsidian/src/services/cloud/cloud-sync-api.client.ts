import { requestUrl } from "obsidian";
import { z } from "zod";

import {
	CLOUD_ENTITY_TYPES,
	type CloudSyncExchangeRequest,
	type CloudSyncExchangeResponse,
	type CloudSyncTransport,
} from "@true-recall/core/integration/cloud/cloud-sync.types";

import type { CloudAuthService } from "./cloud-auth.service";

declare const __TRUERECALL_CLOUD_SYNC_URL__: string;

const CLOUD_SYNC_URL =
	typeof __TRUERECALL_CLOUD_SYNC_URL__ === "string"
		? __TRUERECALL_CLOUD_SYNC_URL__
		: "https://webogcxwvgbwdcjibbno.supabase.co/functions/v1/cloud-sync";

const ChangeSchema = z.object({
	entityType: z.enum(CLOUD_ENTITY_TYPES),
	entityId: z.string().min(1),
	updatedAt: z.number().nonnegative(),
	payload: z.record(z.string(), z.unknown()),
	sourceDeviceId: z.string().min(1).optional(),
});

const ResponseSchema = z.object({
	changes: z.array(ChangeSchema),
	cursor: z.number().int().nonnegative(),
	hasMore: z.boolean(),
});

export class CloudSyncApiClient implements CloudSyncTransport {
	constructor(private readonly auth: CloudAuthService) {}

	async exchange(
		request: CloudSyncExchangeRequest,
	): Promise<CloudSyncExchangeResponse> {
		const session = this.auth.getSession();
		if (!session) throw new Error("Sign in to use Cloud Sync");
		const response = await requestUrl({
			url: CLOUD_SYNC_URL,
			method: "POST",
			contentType: "application/json",
			headers: { Authorization: `Bearer ${session.deviceToken}` },
			body: JSON.stringify(request),
			throw: false,
		});
		if (response.status === 401) {
			this.auth.clearSession();
			throw new Error("Cloud Sync session expired. Sign in again.");
		}
		if (response.status !== 200) {
			throw new Error(
				response.json?.error ?? `Cloud Sync failed (${response.status})`,
			);
		}
		return ResponseSchema.parse(response.json);
	}

	async revoke(): Promise<void> {
		const session = this.auth.getSession();
		if (!session) return;
		await requestUrl({
			url: CLOUD_SYNC_URL,
			method: "DELETE",
			headers: { Authorization: `Bearer ${session.deviceToken}` },
			throw: false,
		});
	}
}
