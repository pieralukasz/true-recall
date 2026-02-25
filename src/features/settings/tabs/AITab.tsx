import {
	DEFAULT_PROMPTS,
	GENERATION_MODE_LABELS,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import { SubscriptionService } from "@features/integration/services/subscription.service";
import type { SubscriptionStatus } from "@features/integration/services/subscription.service";
import { useSettings } from "@features/settings/hooks/useSettings";
import type { AIModelInfo, AIModelKey } from "@shared/constants";
import type { TrueRecallSettings } from "@shared/types/settings.types";
import { AI_MODELS_EXTENDED, TRUERECALL_WEB_URL } from "@shared/constants";
import type { SelectOptionGroup } from "@shared/ui/components";
import {
	Clickable,
	InfoBlock,
	SelectInput,
	SettingRow,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

const subscriptionService = new SubscriptionService();

function groupModelsByProvider(): SelectOptionGroup[] {
	const groups: Record<string, [string, AIModelInfo][]> = {
		Google: [],
		OpenAI: [],
		Anthropic: [],
		Meta: [],
	};

	for (const [key, info] of Object.entries(AI_MODELS_EXTENDED)) {
		const providerGroup = groups[info.provider];
		if (providerGroup) {
			providerGroup.push([key, info]);
		}
	}

	for (const provider of Object.keys(groups)) {
		const providerGroup = groups[provider];
		if (providerGroup) {
			providerGroup.sort((a, b) => {
				if (a[1].recommended && !b[1].recommended) return -1;
				if (!a[1].recommended && b[1].recommended) return 1;
				return 0;
			});
		}
	}

	return Object.entries(groups)
		.filter(([, models]) => models.length > 0)
		.map(([provider, models]) => ({
			label: provider,
			options: models.map(([key, info]) => ({
				value: key,
				label: info.recommended
					? `${info.name} ⭐ (${info.description})`
					: `${info.name} (${info.description})`,
			})),
		}));
}

const PROMPT_MODES: GenerationMode[] = ["basic", "cloze", "reversed", "auto"];

function SubscriptionSection() {
	const { settings, save } = useSettings();
	const [status, setStatus] = useState<SubscriptionStatus | null>(null);
	const [error, setError] = useState("");
	const [validating, setValidating] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const hasSubKey = !!settings.subscriptionKey;

	// Debounced validation: validates 1s after key changes
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (!hasSubKey) {
			setStatus(null);
			setError("");
			if (settings.isSubscriber) {
				save({ isSubscriber: false, subscriberTier: undefined });
			}
			return;
		}

		setValidating(true);
		setError("");

		debounceRef.current = setTimeout(() => {
			const onCacheUpdate = (update: { isSubscriber: boolean; subscriberTier?: string }) => {
				const patch: Partial<TrueRecallSettings> = {
					isSubscriber: update.isSubscriber,
					subscriberTier: update.subscriberTier,
				};
				// Generate userId on first successful validation
				if (update.isSubscriber && !settings.userId) {
					patch.userId = subscriptionService.ensureUserId(settings.userId);
				}
				save(patch);
			};

			subscriptionService
				.getStatus(settings.subscriptionKey!, onCacheUpdate)
				.then((s) => {
					setStatus(s);
					setError("");
				})
				.catch(() => setError("Invalid or expired subscription key."))
				.finally(() => setValidating(false));
		}, 1000);

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [settings.subscriptionKey]);

	const usagePct =
		status && status.budget_max > 0
			? Math.min(100, (status.budget_spent / status.budget_max) * 100)
			: 0;
	const remaining =
		status ? (status.budget_max - status.budget_spent).toFixed(2) : "0.00";

	return (
		<>
			<SettingRow heading name="True Recall Subscription" />

			<InfoBlock>
				<p>
					Subscribe for managed AI access — no API key setup needed.
					Your subscription includes all AI models with usage tracking.
				</p>
				<p>
					<a
						href={`${TRUERECALL_WEB_URL}/pricing`}
						target="_blank"
						rel="noopener"
					>
						View plans at truerecall.app/pricing
					</a>
				</p>
			</InfoBlock>

			<SettingRow
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
			</SettingRow>

			{validating && (
				<div class="ep:px-4 ep:pb-2 ep:text-obs-muted ep:text-ui-smaller">
					Validating key...
				</div>
			)}

			{error && (
				<div class="ep:px-4 ep:pb-2 ep:text-obs-error ep:text-ui-smaller">
					{error}
				</div>
			)}

			{status && !error && (
				<div class="ep:px-4 ep:pb-3">
					<div class="ep:flex ep:items-center ep:gap-2 ep:mb-2">
						<span class="ep:inline-block ep:px-2 ep:py-0.5 ep:rounded-[var(--radius-s)] ep:bg-obs-accent/15 ep:text-obs-accent ep:text-ui-smaller ep:font-semibold ep:capitalize">
							{status.tier}
						</span>
						<span class="ep:text-obs-muted ep:text-ui-smaller">
							${remaining} remaining of ${status.budget_max.toFixed(2)}
						</span>
					</div>
					<div class="ep:w-full ep:h-2 ep:bg-obs-modifier-border ep:rounded-[var(--radius-s)] ep:overflow-hidden">
						<div
							class={`ep:h-full ep:rounded-[var(--radius-s)] ep:transition-all ${usagePct > 80 ? "ep:bg-obs-error" : "ep:bg-obs-accent"}`}
							style={{ width: `${usagePct}%` }}
						/>
					</div>
					<div class="ep:mt-2 ep:flex ep:gap-3">
						<a
							href={`${TRUERECALL_WEB_URL}/dashboard`}
							target="_blank"
							rel="noopener"
							class="ep:text-obs-accent ep:text-ui-smaller"
						>
							Manage subscription
						</a>
					</div>
				</div>
			)}

			{!hasSubKey && (
				<div class="ep:px-4 ep:pb-3">
					<Clickable
						class="ep:text-obs-accent ep:text-ui-smaller ep:underline"
						onClick={() =>
							window.open(`${TRUERECALL_WEB_URL}/pricing`, "_blank")
						}
					>
						Get a subscription at truerecall.app
					</Clickable>
				</div>
			)}
		</>
	);
}

export function AITab() {
	const { settings, save } = useSettings();
	const modelOptions = useMemo(() => groupModelsByProvider(), []);
	const [expandedPrompt, setExpandedPrompt] = useState<GenerationMode | null>(
		null,
	);

	const hasApiKey = !!settings.openRouterApiKey;
	const hasSubKey = !!settings.subscriptionKey;
	const hasAnyKey = hasApiKey || hasSubKey;

	const getPromptValue = useCallback(
		(mode: GenerationMode): string => {
			return settings.aiFlashcardPrompts?.[mode] ?? "";
		},
		[settings.aiFlashcardPrompts],
	);

	const savePrompt = useCallback(
		(mode: GenerationMode, value: string) => {
			const current = settings.aiFlashcardPrompts ?? {};
			save({
				aiFlashcardPrompts: {
					...current,
					[mode]: value,
				},
			});
		},
		[settings.aiFlashcardPrompts, save],
	);

	const resetPrompt = useCallback(
		(mode: GenerationMode) => {
			const current = settings.aiFlashcardPrompts ?? {};
			const updated = { ...current };
			delete updated[mode];
			save({ aiFlashcardPrompts: updated });
		},
		[settings.aiFlashcardPrompts, save],
	);

	return (
		<>
			<SubscriptionSection />

			<SettingRow
				heading
				name={hasSubKey ? "OpenRouter (BYOK — optional)" : "AI (OpenRouter)"}
			/>

			<InfoBlock>
				<p>
					{hasSubKey
						? "You have an active subscription. You can optionally configure your own OpenRouter key as a fallback."
						: "OpenRouter provides access to multiple AI models through a single API."}
				</p>
				{!hasSubKey && (
					<p>
						<a
							href="https://openrouter.ai/keys"
							target="_blank"
							rel="noopener"
						>
							Get your API key at openrouter.ai/keys
						</a>
					</p>
				)}
			</InfoBlock>

			<SettingRow
				name="API key"
				description={
					hasSubKey
						? "Optional fallback key. Subscription key is used when set."
						: "Your OpenRouter API key."
				}
			>
				<TextInput
					value={settings.openRouterApiKey}
					onChange={(v) => save({ openRouterApiKey: v })}
					type="password"
					placeholder="Enter API key"
					class="ep:w-[300px]"
				/>
			</SettingRow>

			<SettingRow name="AI model" description="Select the AI model">
				<SelectInput
					value={settings.aiModel}
					onChange={(v) => save({ aiModel: v as AIModelKey })}
					options={modelOptions}
				/>
			</SettingRow>

			<SettingRow heading name="Flashcard Generation" />

			<SettingRow
				name="Selection toolbar"
				description="Show a floating toolbar above selected text for AI-powered flashcard creation."
			>
				<ToggleInput
					value={settings.selectionToolbarEnabled}
					onChange={(v) => save({ selectionToolbarEnabled: v })}
				/>
			</SettingRow>

			{hasAnyKey && (
				<>
					<InfoBlock>
						<p>
							Customize the prompts used for AI flashcard generation. Leave
							empty to use the built-in defaults. Click a mode to expand its
							prompt editor.
						</p>
					</InfoBlock>

					{PROMPT_MODES.map((mode) => {
						const isExpanded = expandedPrompt === mode;
						const customValue = getPromptValue(mode);
						const isCustom = customValue.trim().length > 0;

						return (
							<div key={mode} class="ep:mb-1">
								<SettingRow
									name={`${GENERATION_MODE_LABELS[mode]} prompt${isCustom ? " (custom)" : ""}`}
									description={
										isExpanded
											? "Edit the system prompt sent to the AI model."
											: isCustom
												? "Using custom prompt. Click to edit."
												: "Using default prompt. Click to customize."
									}
								>
									<div class="ep:flex ep:gap-1">
										{isCustom && (
											<Clickable
												class="ep:text-ui-smaller ep:text-obs-muted ep:px-2 ep:py-1 ep:rounded-[var(--radius-s)] hover:ep:bg-obs-modifier-hover"
												stopPropagation={false}
												onClick={() => resetPrompt(mode)}
											>
												Reset
											</Clickable>
										)}
										<Clickable
											class="ep:text-ui-smaller ep:text-obs-accent ep:px-2 ep:py-1 ep:rounded-[var(--radius-s)] hover:ep:bg-obs-modifier-hover"
											stopPropagation={false}
											onClick={() =>
												setExpandedPrompt(isExpanded ? null : mode)
											}
										>
											{isExpanded ? "Collapse" : "Edit"}
										</Clickable>
									</div>
								</SettingRow>

								{isExpanded && (
									<div class="ep:px-4 ep:pb-3">
										<TextAreaInput
											value={customValue || DEFAULT_PROMPTS[mode]}
											onChange={(v) => savePrompt(mode, v)}
											rows={12}
											class="ep:w-full ep:font-mono ep:text-ui-smaller"
										/>
									</div>
								)}
							</div>
						);
					})}
				</>
			)}
		</>
	);
}
