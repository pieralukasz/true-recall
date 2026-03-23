import {
	DEFAULT_PROMPTS,
	GENERATION_DENSITY_OPTIONS,
	GENERATION_LANGUAGES,
	GENERATION_MODE_LABELS,
	type GenerationDensity,
	type GenerationMode,
} from "@features/ai/prompts/default-prompts";
import { useSettings } from "@features/settings/hooks/useSettings";
import {
	SubscriptionSection,
	subscriptionService,
} from "@features/settings/tabs/SubscriptionSection";
import { TRUERECALL_WEB_URL } from "@shared/constants";
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
import { useCallback, useState } from "preact/hooks";

const PROMPT_MODES: GenerationMode[] = ["basic", "cloze", "reversed", "auto"];

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

				{!hasSubKey && hasApiKey && (
					<div class="ep:border-l-2 ep:border-obs-accent ep:bg-obs-accent/5 ep:pl-3 ep:py-2 ep:rounded-r-[var(--radius-s)] ep:my-2">
						<p class="ep:text-ui-small ep:text-obs-normal ep:mb-1">
							<strong>Tip:</strong> True Recall subscription
							generates higher quality flashcards with
							expert-crafted prompts.
						</p>
						<a
							href={`${TRUERECALL_WEB_URL}/pricing`}
							target="_blank"
							rel="noopener"
							class="ep:text-ui-smaller ep:text-obs-accent"
						>
							Try 50 free generations &rarr;
						</a>
					</div>
				)}

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
