export interface ProSubscriptionInfo {
	status: "active" | "expired" | "none";
	portkeyVirtualKey: string | null;
	budgetRemainingCents: number;
	budgetTotalCents: number;
	budgetResetDate: string;
}

export interface ProBackendAPI {
	getSubscriptionInfo(accessToken: string): Promise<ProSubscriptionInfo>;
	createCheckoutSession(accessToken: string): Promise<{ url: string }>;
	createPortalSession(accessToken: string): Promise<{ url: string }>;
}
