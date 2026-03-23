import { requestUrl } from "obsidian";
import type { ProBackendAPI, ProSubscriptionInfo } from "./pro-backend.types";

export class ProBackendService implements ProBackendAPI {
	constructor(private baseUrl: string) {}

	async getSubscriptionInfo(accessToken: string): Promise<ProSubscriptionInfo> {
		const response = await requestUrl({
			url: `${this.baseUrl}/subscription`,
			method: "GET",
			headers: this.authHeaders(accessToken),
		});

		return response.json as ProSubscriptionInfo;
	}

	async createCheckoutSession(accessToken: string): Promise<{ url: string }> {
		const response = await requestUrl({
			url: `${this.baseUrl}/checkout`,
			method: "POST",
			headers: this.authHeaders(accessToken),
		});

		return response.json as { url: string };
	}

	async createPortalSession(accessToken: string): Promise<{ url: string }> {
		const response = await requestUrl({
			url: `${this.baseUrl}/portal`,
			method: "POST",
			headers: this.authHeaders(accessToken),
		});

		return response.json as { url: string };
	}

	private authHeaders(accessToken: string): Record<string, string> {
		return {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		};
	}
}
