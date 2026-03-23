import { ProBackendService } from "@features/ai/services/pro-backend.service";
import { refreshProStatus } from "@features/ai/services/pro-status";
import type { AuthState } from "@features/integration/services/sync/auth.service";
import { useSettings } from "@features/settings/hooks/useSettings";
import { TRUERECALL_API_URL } from "@shared/constants";
import { Clickable, FormField, InfoBlock } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useState } from "preact/hooks";

function BudgetBar({
	remainingCents,
	totalCents,
}: {
	remainingCents: number;
	totalCents: number;
}) {
	const pct = totalCents > 0 ? (remainingCents / totalCents) * 100 : 0;
	const color =
		pct > 20
			? "ep:bg-obs-green"
			: pct > 5
				? "ep:bg-obs-orange"
				: "ep:bg-obs-error";

	return (
		<div class="ep:flex ep:flex-col ep:gap-1">
			<div class="ep:flex ep:justify-between ep:text-ui-smaller ep:text-obs-muted">
				<span>
					${(remainingCents / 100).toFixed(2)} / $
					{(totalCents / 100).toFixed(2)}
				</span>
				<span>{Math.round(pct)}%</span>
			</div>
			<div class="ep:h-2 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden">
				<div
					class={`ep:h-full ep:rounded-full ep:transition-all ${color}`}
					style={{ width: `${Math.max(pct, 1)}%` }}
				/>
			</div>
		</div>
	);
}

export function ProStatusSection() {
	const plugin = usePlugin();
	const { settings, save } = useSettings();
	const authService = plugin.authService;

	const [authState, setAuthState] = useState<AuthState | null>(null);
	const [checking, setChecking] = useState(true);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!authService) {
			setChecking(false);
			return;
		}
		authService.getAuthState().then((state) => {
			setAuthState(state);
			setChecking(false);
		});

		const { unsubscribe } = authService.onAuthStateChange((_event, session) => {
			setAuthState({
				user: session?.user ?? null,
				session,
				isAuthenticated: session !== null,
			});
		});
		return unsubscribe;
	}, [authService]);

	// Refresh Pro status when authenticated
	useEffect(() => {
		if (!authState?.isAuthenticated || !authService) return;
		const backend = new ProBackendService(TRUERECALL_API_URL);
		refreshProStatus(authService, backend, save);
	}, [authState?.isAuthenticated, authService, save]);

	const handleSubscribe = useCallback(async () => {
		if (!authState?.session?.access_token) return;
		setLoading(true);
		try {
			const backend = new ProBackendService(TRUERECALL_API_URL);
			const { url } = await backend.createCheckoutSession(
				authState.session.access_token,
			);
			window.open(url);
		} catch {
			console.error("[TrueRecall] Failed to create checkout session");
		}
		setLoading(false);
	}, [authState?.session?.access_token]);

	const handleManage = useCallback(async () => {
		if (!authState?.session?.access_token) return;
		setLoading(true);
		try {
			const backend = new ProBackendService(TRUERECALL_API_URL);
			const { url } = await backend.createPortalSession(
				authState.session.access_token,
			);
			window.open(url);
		} catch {
			console.error("[TrueRecall] Failed to create portal session");
		}
		setLoading(false);
	}, [authState?.session?.access_token]);

	if (checking) return null;

	if (!authState?.isAuthenticated) {
		return (
			<InfoBlock>
				Sign in with your account (in the General tab) to use True Recall Pro.
			</InfoBlock>
		);
	}

	const status = settings.proSubscriptionStatus;

	if (status === "active") {
		return (
			<div class="ep:flex ep:flex-col ep:gap-3">
				<FormField
					name="AI budget"
					description={
						settings.proBudgetResetDate
							? `Resets on ${new Date(settings.proBudgetResetDate).toLocaleDateString()}`
							: "Monthly AI generation budget"
					}
				>
					<BudgetBar
						remainingCents={settings.proBudgetRemainingCents ?? 0}
						totalCents={settings.proBudgetTotalCents ?? 500}
					/>
				</FormField>

				<InfoBlock>
					<p>Unlimited AI-powered flashcard generation. No API key needed.</p>
				</InfoBlock>

				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={handleManage}
					disabled={loading}
				>
					Manage subscription
				</Clickable>
			</div>
		);
	}

	if (status === "expired") {
		return (
			<div class="ep:flex ep:flex-col ep:gap-2">
				<InfoBlock>
					<p class="ep:text-obs-error">Your subscription has expired.</p>
					{settings.openRouterApiKey && (
						<p class="ep:text-obs-muted">
							Using your OpenRouter API key as fallback.
						</p>
					)}
				</InfoBlock>
				<Clickable
					class="mod-cta ep-btn"
					onClick={handleSubscribe}
					disabled={loading}
				>
					Resubscribe
				</Clickable>
			</div>
		);
	}

	// No subscription yet
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<InfoBlock>
				<p>
					Unlimited AI-powered flashcard generation. No API key needed.
				</p>
			</InfoBlock>
			<Clickable
				class="mod-cta ep-btn"
				onClick={handleSubscribe}
				disabled={loading}
			>
				Subscribe — $8/month
			</Clickable>
		</div>
	);
}
