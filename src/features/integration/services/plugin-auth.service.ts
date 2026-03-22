import { AUTH_EXCHANGE_URL, AUTH_PLUGIN_URL } from "@shared/constants";
import { requestUrl } from "obsidian";

export interface AuthExchangeResponse {
	subscriptionKey: string;
	tier: string;
	plan_type: string;
	budget_max: number;
	budget_spent: number;
	budget_remaining: number;
	expires: string | null;
	trial_used: boolean;
}

interface PendingAuth {
	state: string;
	createdAt: number;
}

const STATE_TTL_MS = 5 * 60 * 1000;

export class PluginAuthService {
	private pendingAuth: PendingAuth | null = null;

	startAuth(): string {
		const state = crypto.randomUUID();
		this.pendingAuth = { state, createdAt: Date.now() };
		return `${AUTH_PLUGIN_URL}?state=${encodeURIComponent(state)}`;
	}

	private isExpired(): boolean {
		if (!this.pendingAuth) return true;
		return Date.now() - this.pendingAuth.createdAt > STATE_TTL_MS;
	}

	validateState(receivedState: string): boolean {
		if (!this.pendingAuth) return false;
		if (this.pendingAuth.state !== receivedState) return false;
		if (this.isExpired()) {
			this.pendingAuth = null;
			return false;
		}
		// Clear immediately — state is single-use
		this.pendingAuth = null;
		return true;
	}

	async exchangeCode(code: string): Promise<AuthExchangeResponse> {
		const response = await requestUrl({
			url: AUTH_EXCHANGE_URL,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});

		if (response.status !== 200) {
			throw new Error(`Auth exchange failed (HTTP ${response.status})`);
		}

		const data = response.json;
		if (!data?.subscriptionKey) {
			throw new Error("Invalid auth exchange response");
		}
		return data as AuthExchangeResponse;
	}

	get isPending(): boolean {
		return !this.isExpired();
	}

	clearPending(): void {
		this.pendingAuth = null;
	}
}
