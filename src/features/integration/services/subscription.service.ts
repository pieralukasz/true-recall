import { requestUrl } from "obsidian";
import { SUBSCRIPTION_STATUS_URL } from "@shared/constants";

export interface SubscriptionStatus {
	tier: string;
	budget_max: number;
	budget_spent: number;
	budget_remaining: number;
	expires: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class SubscriptionService {
	private cache: SubscriptionStatus | null = null;
	private cacheTimestamp = 0;

	async getStatus(subscriptionKey: string): Promise<SubscriptionStatus> {
		const now = Date.now();
		if (this.cache && now - this.cacheTimestamp < CACHE_TTL_MS) {
			return this.cache;
		}

		const status = await this.fetchStatus(subscriptionKey);
		this.cache = status;
		this.cacheTimestamp = now;
		return status;
	}

	isSubscribed(subscriptionKey: string | undefined): boolean {
		return !!subscriptionKey && subscriptionKey.length > 0;
	}

	invalidateCache(): void {
		this.cache = null;
		this.cacheTimestamp = 0;
	}

	private async fetchStatus(
		subscriptionKey: string,
	): Promise<SubscriptionStatus> {
		const url = `${SUBSCRIPTION_STATUS_URL}?key=${encodeURIComponent(subscriptionKey)}`;

		const response = await requestUrl({ url, method: "GET" });

		if (response.status === 401) {
			throw new Error("Invalid subscription key");
		}

		if (response.status !== 200) {
			throw new Error(
				`Subscription status check failed (${response.status})`,
			);
		}

		return response.json as SubscriptionStatus;
	}
}
