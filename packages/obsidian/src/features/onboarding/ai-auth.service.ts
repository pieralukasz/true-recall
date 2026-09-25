import type { App } from "obsidian";
import { z } from "zod";

import { TRUERECALL_WEB_URL } from "@true-recall/core/constants";

import { requestJson } from "@true-recall/obsidian/adapters/request-json";

const STORAGE = "true-recall-ai-auth-pending";
const TTL = 10 * 60_000;
const Pending = z.object({
	state: z.string().min(32),
	verifier: z.string().min(32),
	createdAt: z.number(),
	deviceId: z.string(),
});
const Result = z.object({ proKey: z.string().min(16) });
const encode = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
export class AIAuthService {
	constructor(
		private readonly app: App,
		private readonly device: () => { id: string; name: string },
	) {}
	async start(): Promise<string> {
		const device = this.device();
		const stored = Pending.safeParse(this.app.loadLocalStorage(STORAGE));
		const pending =
			stored.success &&
			stored.data.deviceId === device.id &&
			Date.now() >= stored.data.createdAt &&
			Date.now() - stored.data.createdAt < TTL
				? stored.data
				: {
						state: encode(crypto.getRandomValues(new Uint8Array(32))),
						verifier: encode(crypto.getRandomValues(new Uint8Array(48))),
						createdAt: Date.now(),
						deviceId: device.id,
					};
		this.app.saveLocalStorage(STORAGE, pending);
		const challenge = encode(
			new Uint8Array(
				await crypto.subtle.digest(
					"SHA-256",
					new TextEncoder().encode(pending.verifier),
				),
			),
		);
		const query = new URLSearchParams({
			state: pending.state,
			challenge,
			device_id: device.id,
			device_name: device.name,
			vault: this.app.vault.getName(),
		});
		return `${TRUERECALL_WEB_URL}/auth/ai?${query}`;
	}
	async exchange(code: string, state: string): Promise<string> {
		const parsed = Pending.safeParse(this.app.loadLocalStorage(STORAGE));
		if (!parsed.success || parsed.data.state !== state)
			throw new Error(
				"This sign-in belongs to an older request. Start again from Try AI.",
			);
		const pending = parsed.data;
		if (
			Date.now() < pending.createdAt ||
			Date.now() - pending.createdAt >= TTL ||
			pending.deviceId !== this.device().id
		) {
			this.app.saveLocalStorage(STORAGE, null);
			throw new Error("AI sign-in expired. Start again from Try AI.");
		}
		const response = await requestJson({
			url: `${TRUERECALL_WEB_URL}/api/auth/ai-exchange`,
			method: "POST",
			body: {
				code,
				state,
				verifier: pending.verifier,
				deviceId: pending.deviceId,
			},
			provider: "true-recall-auth",
		});
		const current = Pending.safeParse(this.app.loadLocalStorage(STORAGE));
		if (!current.success || current.data.state !== state)
			throw new Error("A newer AI sign-in has started.");
		const result = Result.parse(response);
		this.app.saveLocalStorage(STORAGE, null);
		return result.proKey;
	}
}
