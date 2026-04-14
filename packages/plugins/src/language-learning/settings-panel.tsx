import { GENERATION_LANGUAGES } from "@true-recall/core/ai/prompts/default-prompts";
import { TTS_VOICES } from "@true-recall/core/constants";

import {
	FormField,
	SelectInput,
	TextAreaInput,
	ToggleInput,
} from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";

export function LanguageLearningSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const activePreset = settings.activeGenerationPresetId
		? settings.generationPresets.find(
				(p) => p.id === settings.activeGenerationPresetId,
			)
		: null;

	const languageOptions = GENERATION_LANGUAGES.filter(
		(l) => l.value !== "auto",
	).map((l) => ({ value: l.value, label: l.label }));

	function updatePresetField(
		field: "sourceLanguage" | "targetLanguage" | "systemPrompt",
		value: string,
	) {
		const updated = settings.generationPresets.map((p) =>
			p.id === settings.activeGenerationPresetId ? { ...p, [field]: value } : p,
		);
		void save({ generationPresets: updated });
	}

	return (
		<>
			<FormField
				name="Generation Preset"
				description="Select a preset for language flashcard generation"
			>
				<SelectInput
					value={settings.activeGenerationPresetId ?? ""}
					onChange={(v) =>
						void save({
							activeGenerationPresetId: v.length > 0 ? v : null,
						})
					}
					options={[
						{ value: "", label: "None (standard generation)" },
						...settings.generationPresets.map((p) => ({
							value: p.id,
							label: p.name,
						})),
					]}
				/>
			</FormField>

			{activePreset && (
				<>
					<FormField
						name="Source language"
						description="The language being learned"
					>
						<SelectInput
							value={activePreset.sourceLanguage}
							onChange={(v) => updatePresetField("sourceLanguage", v)}
							options={languageOptions}
						/>
					</FormField>
					<FormField name="Target language" description="Your native language">
						<SelectInput
							value={activePreset.targetLanguage}
							onChange={(v) => updatePresetField("targetLanguage", v)}
							options={languageOptions}
						/>
					</FormField>
					<FormField
						name="Custom prompt"
						description="Leave empty to use the built-in prompt for this preset"
					>
						<TextAreaInput
							value={activePreset.systemPrompt}
							onChange={(v) => updatePresetField("systemPrompt", v)}
							rows={4}
							class="ep:w-full ep:font-mono ep:text-ui-smaller"
						/>
					</FormField>
				</>
			)}

			<FormField
				name="TTS Voice"
				description="Voice used for text-to-speech audio generation"
			>
				<SelectInput
					value={settings.ttsVoice}
					onChange={(v) => void save({ ttsVoice: v })}
					options={TTS_VOICES.map((v) => ({ value: v, label: v }))}
				/>
			</FormField>

			<FormField
				name="Auto-play TTS"
				description="Automatically play TTS audio when a card is shown in review"
			>
				<ToggleInput
					value={settings.ttsAutoplay}
					onChange={(v) => void save({ ttsAutoplay: v })}
				/>
			</FormField>
		</>
	);
}
