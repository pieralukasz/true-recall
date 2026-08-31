import type { App, SecretStorage } from "obsidian";
import { requestUrl } from "obsidian";
import { z } from "zod";

import { TRUERECALL_WEB_URL } from "@true-recall/core/constants";

const AUTH_EXCHANGE_URL = `${TRUERECALL_WEB_URL}/api/auth/exchange`;
const PENDING_KEY = "true-recall-cloud-auth-pending";
const SESSION_KEY = "true-recall-cloud-session";
const STATE_TTL_MS = 10 * 60 * 1000;

const SessionSchema = z.object({
	deviceToken: z.string().min(32),
	userId: z.string().uuid(),
	email: z.string().email(),
});

const PendingSchema = z.object({
	state: z.string().min(16),
	verifier: z.string().min(32),
	createdAt: z.number(),
});

export type CloudSession = z.infer<typeof SessionSchema>;
type PendingAuth = z.infer<typeof PendingSchema>;

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function randomToken(bytes = 32): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function challengeFor(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(verifier),
	);
	return base64Url(new Uint8Array(digest));
}

export class CloudAuthService {
	constructor(
		private readonly app: App,
		private readonly getDevice: () => { id: string; name: string },
	) {}

	async startAuth(): Promise<string> {
		const pending: PendingAuth = {
			state: randomToken(),
			verifier: randomToken(48),
			createdAt: Date.now(),
		};
		this.app.saveLocalStorage(PENDING_KEY, pending);
		const challenge = await challengeFor(pending.verifier);
		const device = this.getDevice();
		const params = new URLSearchParams({
			state: pending.state,
			challenge,
			device_id: device.id,
			device_name: device.name,
			vault: this.app.vault.getName(),
		});
		return `${TRUERECALL_WEB_URL}/auth/plugin?${params}`;
	}

	async exchange(code: string, state: string): Promise<CloudSession> {
		const pending = PendingSchema.safeParse(
			this.app.loadLocalStorage(PENDING_KEY),
		);
		if (!pending.success) {
			this.app.saveLocalStorage(PENDING_KEY, null);
			throw new Error("No Cloud Sync sign-in request is pending");
		}
		if (pending.data.state !== state) {
			throw new Error("This sign-in link belongs to an older request");
		}
		if (Date.now() - pending.data.createdAt > STATE_TTL_MS) {
			this.app.saveLocalStorage(PENDING_KEY, null);
			throw new Error(
				"The sign-in request expired. Start again from True Recall settings.",
			);
		}

		const device = this.getDevice();
		const response = await requestUrl({
			url: AUTH_EXCHANGE_URL,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify({
				code,
				state,
				verifier: pending.data.verifier,
				deviceId: device.id,
				deviceName: device.name,
			}),
			throw: false,
		});
		this.app.saveLocalStorage(PENDING_KEY, null);
		if (response.status !== 200) {
			throw new Error(
				response.json?.error ?? `Sign-in failed (${response.status})`,
			);
		}
		const session = SessionSchema.parse(response.json);
		this.saveSession(session);
		return session;
	}

	getSession(): CloudSession | null {
		const raw =
			this.secretStorage()?.getSecret(SESSION_KEY) ??
			this.app.loadLocalStorage(SESSION_KEY);
		if (!raw) return null;
		try {
			return SessionSchema.parse(
				typeof raw === "string" ? JSON.parse(raw) : raw,
			);
		} catch {
			this.clearSession();
			return null;
		}
	}

	clearSession(): void {
		this.secretStorage()?.setSecret(SESSION_KEY, "");
		this.app.saveLocalStorage(SESSION_KEY, null);
	}

	private saveSession(session: CloudSession): void {
		const serialized = JSON.stringify(session);
		const storage = this.secretStorage();
		if (storage) storage.setSecret(SESSION_KEY, serialized);
		else this.app.saveLocalStorage(SESSION_KEY, serialized);
	}

	private secretStorage(): SecretStorage | undefined {
		return (this.app as App & { secretStorage?: SecretStorage }).secretStorage;
	}
}
