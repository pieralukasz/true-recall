import { z } from "zod";

import { HttpError, InvalidResponseError } from "@true-recall/core/errors";
import {
	CLOUD_ENTITY_TYPES,
	type CloudSyncExchangeRequest,
	type CloudSyncExchangeResponse,
	type CloudSyncTransport,
} from "@true-recall/core/integration/cloud/cloud-sync.types";

import { requestJson } from "@true-recall/obsidian/adapters/request-json";

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
	constructor(
		private readonly auth: CloudAuthService,
		private readonly onAuthExpired?: () => void,
	) {}

	async exchange(
		request: CloudSyncExchangeRequest,
	): Promise<CloudSyncExchangeResponse> {
		const session = this.auth.getSession();
		if (!session)
			throw new HttpError(401, { backendCode: "cloud-session-missing" });
		let body: unknown;
		try {
			body = await requestJson({
				url: CLOUD_SYNC_URL,
				method: "POST",
				headers: { Authorization: `Bearer ${session.deviceToken}` },
				body: request,
				provider: "cloud-sync",
			});
		} catch (error) {
			if (
				error instanceof HttpError &&
				error.statusCode === 401 &&
				this.auth.getSession()?.deviceToken === session.deviceToken
			) {
				this.auth.clearSession();
				this.onAuthExpired?.();
				throw new HttpError(401, {
					backendCode: "cloud-session-expired",
					provider: "cloud-sync",
					cause: error,
				});
			}
			throw error;
		}
		const parsed = ResponseSchema.safeParse(body);
		if (!parsed.success) {
			throw new InvalidResponseError(
				"Cloud Sync response does not match its contract",
				{
					cause: parsed.error,
					context: { provider: "cloud-sync" },
				},
			);
		}
		return parsed.data;
	}

	/**
	 * Revokes this device's token server-side. Returns whether the token is
	 * dead (revoked now, or already invalid); on false the token is still a
	 * live credential and the local session must not be discarded silently.
	 */
	async revoke(): Promise<boolean> {
		const session = this.auth.getSession();
		if (!session) return true;
		try {
			await requestJson({
				url: CLOUD_SYNC_URL,
				method: "DELETE",
				headers: { Authorization: `Bearer ${session.deviceToken}` },
				provider: "cloud-sync",
			});
			return true;
		} catch (error) {
			return error instanceof HttpError && error.statusCode === 401;
		}
	}
}
