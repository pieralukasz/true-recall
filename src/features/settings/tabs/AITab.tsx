import {
	DEFAULT_PROMPTS,
	GENERATION_DENSITY_OPTIONS,
	GENERATION_LANGUAGES,
	GENERATION_MODE_LABELS,
	type GenerationDensity,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
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
	SelectInput,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const subscriptionService = new SubscriptionService();

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
				save({
					isSubscriber: false,
					subscriberTier: undefined,
					cachedAllowedModels: undefined,
				});
			}
			return;
		}

		setValidating(true);
		setError("");

		debounceRef.current = setTimeout(() => {
			const onCacheUpdate = (update: {
				isSubscriber: boolean;
				subscriberTier?: string;
				allowedModels?: string[];
			}) => {
				const patch: Partial<TrueRecallSettings> = {
					isSubscriber: update.isSubscriber,
					subscriberTier: update.subscriberTier,
					cachedAllowedModels: update.allowedModels,
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
	const approxGenerations = status
		? Math.floor((status.budget_max - status.budget_spent) / 0.007)
		: 0;

	return (
		<FormCard title="True Recall AI">
			<InfoBlock>
				<p>
					Subscribe for instant AI access — no setup needed. Generate
					flashcards, image occlusion, and more.
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

			{validating && (
				<div class="ep:py-2 ep:text-obs-muted ep:text-ui-smaller">
					Validating key...
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
							~{approxGenerations} generations remaining
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
					<div class="ep:mt-2 ep:flex ep:gap-3">
						<a
							href={`${TRUERECALL_WEB_URL}/dashboard`}
							target="_blank"
							rel="noopener"
							class="ep:text-obs-accent ep:text-ui-smaller"
						>
							Manage subscription
						</a>
						{status.budget_remaining < 0.5 && (
							<a
								href={`${TRUERECALL_WEB_URL}/dashboard`}
								target="_blank"
								rel="noopener"
								class="ep:text-obs-accent ep:text-ui-smaller"
							>
								Top up budget
							</a>
						)}
					</div>
				</div>
			)}

			{!hasSubKey && (
				<div class="ep:py-3 ep:flex ep:flex-col ep:gap-1">
					<Clickable
						class="ep:text-obs-accent ep:text-ui-smaller ep:underline"
						onClick={() =>
							window.open(`${TRUERECALL_WEB_URL}/pricing`, "_blank")
						}
					>
						Start free trial (~50 generations, no card required)
					</Clickable>
					<Clickable
						class="ep:text-obs-muted ep:text-ui-smaller ep:underline"
						onClick={() =>
							window.open(`${TRUERECALL_WEB_URL}/pricing`, "_blank")
						}
					>
						View plans at truerecall.app
					</Clickable>
				</div>
			)}
		</FormCard>
	);
}

export function AITab() {
	const { settings, save } = useSettings();
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
		<div class="ep:flex ep:flex-col ep:gap-3">
			<SubscriptionSection />

			<FormCard title="OpenRouter API Key (Advanced)">
				<InfoBlock>
					<p>
						{hasSubKey
							? "You have an active subscription. Optionally add your own API key as a fallback."
							: "Already have an OpenRouter key? Use it to access AI features directly."}
					</p>
				</InfoBlock>

				<FormField
					name="API key"
					description={
						hasSubKey
							? "Optional fallback. Subscription is used when set."
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
				</FormField>

				{!hasSubKey && !hasApiKey && (
					<InfoBlock>
						<p>
							<a
								href="https://openrouter.ai/keys"
								target="_blank"
								rel="noopener"
							>
								Get your API key at openrouter.ai/keys
							</a>
						</p>
					</InfoBlock>
				)}
			</FormCard>

			<FormCard title="AI Prompts">
				<FormField
					name="Type-in grading prompt"
					description="Optional custom system prompt for AI answer grading during review type-in mode. Leave empty to use built-in prompt."
				>
					<TextAreaInput
						value={settings.aiTypeInGradingPrompt ?? ""}
						onChange={(v) =>
							save({
								aiTypeInGradingPrompt: v.trim().length > 0 ? v : undefined,
							})
						}
						rows={6}
						class="ep:w-full ep:font-mono ep:text-ui-smaller"
					/>
				</FormField>
				<FormField
					name="Image occlusion detection prompt"
					description="Custom prompt for AI region detection in image occlusion. Leave empty to use built-in prompt."
				>
					<TextAreaInput
						value={settings.aiIODetectionPrompt ?? ""}
						onChange={(v) =>
							save({
								aiIODetectionPrompt: v.trim().length > 0 ? v : undefined,
							})
						}
						rows={4}
						class="ep:w-full ep:font-mono ep:text-ui-smaller"
					/>
				</FormField>
			</FormCard>

			<FormCard title="Flashcard Generation">
				<FormField
					name="Generation language"
					description="Language for AI-generated flashcards. Auto-detect matches the source text language."
				>
					<SelectInput
						value={settings.generationLanguage ?? "auto"}
						onChange={(v) => save({ generationLanguage: v })}
						options={[...GENERATION_LANGUAGES]}
					/>
				</FormField>

				<FormField
					name="Note generation density"
					description="Controls how many flashcards are created when generating from an entire note."
				>
					<SelectInput
						value={settings.generationDensity ?? "balanced"}
						onChange={(v) =>
							save({ generationDensity: v as GenerationDensity })
						}
						options={[...GENERATION_DENSITY_OPTIONS]}
					/>
				</FormField>

				<FormField
					name="Selection toolbar"
					description="Show a floating toolbar above selected text for AI-powered flashcard creation."
				>
					<ToggleInput
						value={settings.selectionToolbarEnabled}
						onChange={(v) => save({ selectionToolbarEnabled: v })}
					/>
				</FormField>

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
									<FormField
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
									</FormField>

									{isExpanded && (
										<div class="ep:pb-3">
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
			</FormCard>
		</div>
	);
}
