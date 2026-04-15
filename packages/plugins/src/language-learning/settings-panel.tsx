import { GENERATION_LANGUAGES } from "@true-recall/core/ai/prompts/default-prompts";
import { TTS_VOICES } from "@true-recall/core/constants";
import { BUILTIN_BASIC_ID } from "@true-recall/core/types/note.types";

import {
	FormField,
	SelectInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { NoteTypePicker } from "@true-recall/obsidian/modals/core/add-flashcards/NoteTypePicker";

import type { PluginSettingsProps } from "../types";

export function LanguageLearningSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const languageOptions = GENERATION_LANGUAGES.filter(
		(l) => l.value !== "auto",
	).map((l) => ({ value: l.value, label: l.label }));

	return (
		<>
			<FormField
				name="Note type"
				description="Note type for vocabulary flashcards. Leave as Basic to use the same as standard generation."
			>
				<NoteTypePicker
					value={
						settings.languageNoteTypeId ??
						settings.generationNoteTypeId ??
						BUILTIN_BASIC_ID
					}
					onChange={(id) =>
						void save({
							languageNoteTypeId: id === BUILTIN_BASIC_ID ? null : id,
						})
					}
				/>
			</FormField>
			<FormField
				name="Source language"
				description="The language being learned"
			>
				<SelectInput
					value={settings.languageSource}
					onChange={(v) => void save({ languageSource: v })}
					options={[{ value: "", label: "Not set" }, ...languageOptions]}
				/>
			</FormField>
			<FormField name="Target language" description="Your native language">
				<SelectInput
					value={settings.languageTarget}
					onChange={(v) => void save({ languageTarget: v })}
					options={[{ value: "", label: "Not set" }, ...languageOptions]}
				/>
			</FormField>

			<FormField
				name="TTS field"
				description="Note field to generate audio for (e.g. Front, Back, Word)"
			>
				<TextInput
					value={settings.languageTtsField}
					onChange={(v) => void save({ languageTtsField: v })}
					placeholder="Back"
				/>
			</FormField>
			<FormField
				name="TTS enabled"
				description="Generate audio after vocab creation"
			>
				<ToggleInput
					value={settings.languageTtsEnabled}
					onChange={(v) => void save({ languageTtsEnabled: v })}
				/>
			</FormField>

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
