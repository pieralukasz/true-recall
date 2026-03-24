import type { AuthService } from "@features/integration/services/sync/auth.service";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import type { ProBackendService } from "./pro-backend.service";

export async function refreshProStatus(
	authService: AuthService | null,
	backendService: ProBackendService,
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>,
): Promise<void> {
	if (!authService) return;

	const authState = await authService.getAuthState();
	if (!authState.session?.access_token) return;

	try {
		const info = await backendService.getSubscriptionInfo(
			authState.session.access_token,
		);
		await save({
			proSubscriptionStatus: info.status,
			portkeyVirtualKey: info.portkeyVirtualKey ?? undefined,
			proBudgetRemainingCents: info.budgetRemainingCents,
			proBudgetTotalCents: info.budgetTotalCents,
			proBudgetResetDate: info.budgetResetDate ?? undefined,
		});
	} catch (error) {
		console.warn("[TrueRecall] Failed to refresh Pro status:", error);
	}
}
