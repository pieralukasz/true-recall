import { SUBSCRIPTION_STATUS_URL } from "@shared/constants";
import { requestUrl } from "obsidian";

export interface SubscriptionStatus {
	tier: string;
	budget_max: number;
	budget_spent: number;
	budget_remaining: number;
	expires: string | null;
}

export interface SubscriptionCacheUpdate {
	isSubscriber: boolean;
	subscriberTier?: string;
	userId?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export class SubscriptionService {
	private cache: SubscriptionStatus | null = null;
	private cacheTimestamp = 0;

	async getStatus(
		subscriptionKey: string,
		onCacheUpdate?: (update: SubscriptionCacheUpdate) => void,
	): Promise<SubscriptionStatus> {
		const now = Date.now();
		if (this.cache && now - this.cacheTimestamp < CACHE_TTL_MS) {
			return this.cache;
		}

		try {
			const status = await this.fetchStatus(subscriptionKey);
			this.cache = status;
			this.cacheTimestamp = now;

			onCacheUpdate?.({
				isSubscriber: true,
				subscriberTier: status.tier,
			});

			return status;
		} catch (error) {
			onCacheUpdate?.({ isSubscriber: false });
			throw error;
		}
	}

	isSubscribed(subscriptionKey: string | undefined): boolean {
		return !!subscriptionKey && subscriptionKey.length > 0;
	}

	invalidateCache(): void {
		this.cache = null;
		this.cacheTimestamp = 0;
	}

	/**
	 * Generate a stable user UUID if not already present.
	 * Returns existing userId or a newly generated one.
	 */
	ensureUserId(currentUserId: string | undefined): string {
		if (currentUserId) return currentUserId;
		return crypto.randomUUID();
	}

	private async fetchStatus(
		subscriptionKey: string,
	): Promise<SubscriptionStatus> {
		const url = `${SUBSCRIPTION_STATUS_URL}?key=${encodeURIComponent(subscriptionKey)}`;

		const response = await requestUrl({ url, method: "GET" });

		if (response.status === 401) {
			throw new Error("Invalid or expired subscription key.");
		}

		if (response.status !== 200) {
			// Never include the raw key in error messages
			throw new Error(
				`Subscription status check failed (HTTP ${response.status}).`,
			);
		}

		return response.json as SubscriptionStatus;
	}
}
