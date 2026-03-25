import {
	GENERATION_DENSITY_OPTIONS,
	GENERATION_LANGUAGES,
	type GenerationDensity,
} from "@features/ai/prompts/default-prompts";
import { useSettings } from "@features/settings/hooks/useSettings";
import {
	FormCard,
	FormField,
	SelectInput,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";

export function AITab() {
	const { settings, save } = useSettings();

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<FormCard title="Own API Key (Free)">
				<FormField
					name="OpenRouter API key"
					description="Bring your own OpenRouter key. Used when no Pro key is set."
				>
					<TextInput
						value={settings.openRouterApiKey}
						onChange={(v) => save({ openRouterApiKey: v })}
						type="password"
						placeholder="Enter API key"
						class="ep:w-[300px]"
					/>
				</FormField>
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

			</FormCard>
		</div>
	);
}
