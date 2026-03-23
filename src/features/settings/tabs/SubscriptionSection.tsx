import type { SubscriptionStatus } from "@features/integration/services/subscription.service";
import { SubscriptionService } from "@features/integration/services/subscription.service";
import { useSettings } from "@features/settings/hooks/useSettings";
import { TRUERECALL_WEB_URL } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
} from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const subscriptionService = new SubscriptionService();

export { subscriptionService };

export function SubscriptionSection() {
	const { settings, save } = useSettings();
	const plugin = usePlugin();
	const [status, setStatus] = useState<SubscriptionStatus | null>(null);
	const [error, setError] = useState("");
	const [backgroundError, setBackgroundError] = useState("");
	const [validating, setValidating] = useState(false);
	const [awaitingBrowser, setAwaitingBrowser] = useState(false);
	const [showManualInput, setShowManualInput] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const activeKeyRef = useRef<string | undefined>(settings.subscriptionKey);

	const hasSubKey = !!settings.subscriptionKey;

	const handleSignIn = useCallback(() => {
		if (!plugin.pluginAuth) return;
		const url = plugin.pluginAuth.startAuth();
		window.open(url, "_blank");
		setAwaitingBrowser(true);
	}, [plugin]);

	const handleCancelSignIn = useCallback(() => {
		plugin.pluginAuth?.clearPending();
		setAwaitingBrowser(false);
	}, [plugin]);

	const handleLogout = useCallback(() => {
		subscriptionService.invalidateCache();
		setStatus(null);
		setError("");
		setBackgroundError("");
		setAwaitingBrowser(false);
		save({
			subscriptionKey: undefined,
			isSubscriber: false,
			subscriberTier: undefined,
			cachedSubscriptionStatus: undefined,
		});
	}, [save]);

	useEffect(() => {
		if (hasSubKey && awaitingBrowser) {
			setAwaitingBrowser(false);
		}
	}, [hasSubKey, awaitingBrowser]);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		activeKeyRef.current = settings.subscriptionKey;

		if (!hasSubKey) {
			setStatus(null);
			setError("");
			setBackgroundError("");
			if (settings.isSubscriber) {
				save({
					isSubscriber: false,
					subscriberTier: undefined,
					cachedSubscriptionStatus: undefined,
				});
			}
			return;
		}

		const cached =
			subscriptionService.getCachedStatus() ??
			(settings.cachedSubscriptionStatus as SubscriptionStatus | undefined) ??
			null;
		const hasCached = cached !== null;

		if (hasCached) {
			setStatus(cached);
			setValidating(false);
		} else {
			setValidating(true);
		}
		setError("");
		setBackgroundError("");

		const delay = hasCached ? 0 : 1000;
		if (!settings.subscriptionKey) return;
		const keyAtFetch = settings.subscriptionKey;

		debounceRef.current = setTimeout(() => {
			const onCacheUpdate = (update: {
				isSubscriber: boolean;
				subscriberTier?: string;
			}) => {
				if (activeKeyRef.current !== keyAtFetch) return;
				const patch: Partial<TrueRecallSettings> = {
					isSubscriber: update.isSubscriber,
					subscriberTier: update.subscriberTier,
				};
				if (update.isSubscriber && !settings.userId) {
					patch.userId = subscriptionService.ensureUserId(settings.userId);
				}
				save(patch);
			};

			subscriptionService
				.getStatus(keyAtFetch, onCacheUpdate)
				.then((s) => {
					if (activeKeyRef.current !== keyAtFetch) return;
					setStatus(s);
					setError("");
					setBackgroundError("");
					save({ cachedSubscriptionStatus: s });
				})
				.catch(() => {
					if (activeKeyRef.current !== keyAtFetch) return;
					if (hasCached) {
						setBackgroundError(
							"Could not verify subscription. Using cached status.",
						);
					} else {
						setError("Invalid or expired subscription key.");
					}
				})
				.finally(() => {
					if (activeKeyRef.current === keyAtFetch) {
						setValidating(false);
					}
				});
		}, delay);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [settings.subscriptionKey]);

	const usagePct =
		status && status.budget_max > 0
			? Math.min(
					100,
					Math.round((status.budget_spent / status.budget_max) * 100),
				)
			: 0;

	return (
		<FormCard title="True Recall AI">
			<InfoBlock>
				<p>
					Sign in for instant AI access — no setup needed. Generate flashcards,
					image occlusion, and more.
				</p>
			</InfoBlock>

			{validating && (
				<div class="ep:py-2 ep:text-obs-muted ep:text-ui-smaller">
					Validating subscription...
				</div>
			)}

			{error && (
				<div class="ep:py-2 ep:text-obs-error ep:text-ui-smaller">{error}</div>
			)}

			{status && !error && (
				<div class="ep:py-3">
					<div class="ep:flex ep:items-center ep:gap-2 ep:mb-2">
						<span class="ep:inline-block ep:px-2 ep:py-0.5 ep:rounded-[var(--radius-s)] ep:bg-obs-accent/15 ep:text-obs-accent ep:text-ui-smaller ep:font-semibold ep:capitalize">
							{status.tier}
						</span>
						<span class="ep:text-obs-muted ep:text-ui-smaller">
							{usagePct}% used
						</span>
					</div>
					{status.tier === "trial" && (
						<div class="ep:text-obs-muted ep:text-ui-smaller ep:mb-2">
							One-time trial. Subscribe for monthly AI access.
						</div>
					)}
					<div class="ep:w-full ep:h-2 ep:bg-obs-modifier-border ep:rounded-[var(--radius-s)] ep:overflow-hidden">
						<div
							class={`ep:h-full ep:rounded-[var(--radius-s)] ep:transition-all ${usagePct > 80 ? "ep:bg-obs-error" : "ep:bg-obs-accent"}`}
							style={{ width: `${usagePct}%` }}
						/>
					</div>
					{backgroundError && (
						<div class="ep:mt-1 ep:text-obs-muted ep:text-ui-smaller ep:italic">
							{backgroundError}
						</div>
					)}
					<div class="ep:mt-2 ep:flex ep:gap-3">
						<a
							href={`${TRUERECALL_WEB_URL}/dashboard`}
							target="_blank"
							rel="noopener"
							class="ep:text-obs-accent ep:text-ui-smaller"
						>
							Manage subscription
						</a>
						<Clickable
							class="ep:text-obs-error ep:text-ui-smaller"
							onClick={handleLogout}
						>
							Log out
						</Clickable>
					</div>
				</div>
			)}

			{!hasSubKey && !awaitingBrowser && (
				<div class="ep:py-3 ep:flex ep:flex-col ep:gap-3">
					<Clickable
						class="mod-cta ep:px-4 ep:py-2 ep:rounded-[var(--radius-s)] ep:text-ui-small ep:font-medium ep:inline-flex ep:items-center ep:justify-center ep:w-fit"
						onClick={handleSignIn}
					>
						Sign in with True Recall
					</Clickable>
					<div class="ep:flex ep:flex-col ep:gap-1">
						<Clickable
							class="ep:text-obs-muted ep:text-ui-smaller"
							onClick={() => setShowManualInput((v) => !v)}
						>
							{showManualInput ? "Hide manual input" : "Enter key manually"}
						</Clickable>
						{showManualInput && (
							<FormField
								name="Subscription key"
								description="Paste the key from your truerecall.app dashboard."
							>
								<TextInput
									value={settings.subscriptionKey ?? ""}
									onChange={(v) => {
										subscriptionService.invalidateCache();
										save({ subscriptionKey: v || undefined });
									}}
									type="password"
									placeholder="tr-xxxxxxxxxxxx"
									class="ep:w-[300px]"
								/>
							</FormField>
						)}
					</div>
				</div>
			)}

			{!hasSubKey && awaitingBrowser && (
				<div class="ep:py-3 ep:flex ep:flex-col ep:gap-2">
					<div class="ep:text-obs-muted ep:text-ui-small ep:flex ep:items-center ep:gap-2">
						<span class="ep:animate-pulse">
							Waiting for browser sign-in...
						</span>
					</div>
					<Clickable
						class="ep:text-obs-muted ep:text-ui-smaller"
						onClick={handleCancelSignIn}
					>
						Cancel
					</Clickable>
				</div>
			)}
		</FormCard>
	);
}
