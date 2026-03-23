import {
	DEFAULT_BASIC_PROMPT,
	GENERATION_DENSITY_OPTIONS,
	GENERATION_LANGUAGES,
	type GenerationDensity,
} from "@features/ai/prompts/default-prompts";
import { useSettings } from "@features/settings/hooks/useSettings";
import { ProStatusSection } from "@features/settings/tabs/ProStatusSection";
import type { AITier } from "@shared/types/settings.types";
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

const TIER_OPTIONS: { value: AITier; label: string }[] = [
	{ value: "byok", label: "Bring Your Own Key" },
	{ value: "pro", label: "True Recall Pro" },
];

export function AITab() {
	const { settings, save } = useSettings();
	const [promptExpanded, setPromptExpanded] = useState(false);

	const tier = settings.aiTier ?? "byok";
	const hasApiKey = !!settings.openRouterApiKey;
	const hasAIAccess = tier === "pro" || hasApiKey;

	const customPrompt = settings.aiFlashcardPrompts?.basic ?? "";
	const isCustomPrompt = customPrompt.trim().length > 0;

	const savePrompt = useCallback(
		(value: string) => {
			save({
				aiFlashcardPrompts: {
					...settings.aiFlashcardPrompts,
					basic: value,
				},
			});
		},
		[settings.aiFlashcardPrompts, save],
	);

	const resetPrompt = useCallback(() => {
		const current = settings.aiFlashcardPrompts ?? {};
		const updated = { ...current };
		delete updated.basic;
		save({ aiFlashcardPrompts: updated });
	}, [settings.aiFlashcardPrompts, save]);

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<FormCard title="AI Provider">
				<FormField
					name="Provider"
					description="Choose how AI features are powered."
				>
					<div class="ep:flex ep:gap-1">
						{TIER_OPTIONS.map((opt) => (
							<Clickable
								key={opt.value}
								class={`ep:px-3 ep:py-1.5 ep:rounded-[var(--radius-s)] ep:text-ui-smaller ep:transition-colors ${
									tier === opt.value
										? "ep:bg-obs-interactive-accent ep:text-obs-on-accent"
										: "ep:bg-obs-modifier-hover ep:text-obs-muted hover:ep:text-obs-normal"
								}`}
								onClick={() => save({ aiTier: opt.value })}
							>
								{opt.label}
							</Clickable>
						))}
					</div>
				</FormField>

				{tier === "byok" && (
					<FormField
						name="OpenRouter API key"
						description="Your OpenRouter API key for AI-powered features."
					>
						<TextInput
							value={settings.openRouterApiKey}
							onChange={(v) => save({ openRouterApiKey: v })}
							type="password"
							placeholder="Enter API key"
							class="ep:w-[300px]"
						/>
					</FormField>
				)}

				{tier === "pro" && <ProStatusSection />}
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

				{hasAIAccess && (
					<>
						<InfoBlock>
							<p>
								Customize the prompt used for AI flashcard generation. Leave
								empty to use the built-in default.
							</p>
						</InfoBlock>

						<FormField
							name={`Generation prompt${isCustomPrompt ? " (custom)" : ""}`}
							description={
								promptExpanded
									? "Edit the system prompt sent to the AI model."
									: isCustomPrompt
										? "Using custom prompt. Click to edit."
										: "Using default prompt. Click to customize."
							}
						>
							<div class="ep:flex ep:gap-1">
								{isCustomPrompt && (
									<Clickable
										class="ep:text-ui-smaller ep:text-obs-muted ep:px-2 ep:py-1 ep:rounded-[var(--radius-s)] hover:ep:bg-obs-modifier-hover"
										stopPropagation={false}
										onClick={resetPrompt}
									>
										Reset
									</Clickable>
								)}
								<Clickable
									class="ep:text-ui-smaller ep:text-obs-accent ep:px-2 ep:py-1 ep:rounded-[var(--radius-s)] hover:ep:bg-obs-modifier-hover"
									stopPropagation={false}
									onClick={() => setPromptExpanded(!promptExpanded)}
								>
									{promptExpanded ? "Collapse" : "Edit"}
								</Clickable>
							</div>
						</FormField>

						{promptExpanded && (
							<div class="ep:pb-3">
								<TextAreaInput
									value={customPrompt || DEFAULT_BASIC_PROMPT}
									onChange={savePrompt}
									rows={12}
									class="ep:w-full ep:font-mono ep:text-ui-smaller"
								/>
							</div>
						)}
					</>
				)}
			</FormCard>
		</div>
	);
}
