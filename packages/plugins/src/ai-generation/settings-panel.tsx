import { GENERATION_LANGUAGES } from "@true-recall/core/ai/prompts/default-prompts";
import { BUILTIN_BASIC_ID } from "@true-recall/core/types/note.types";

import {
	FormField,
	SelectInput,
	TextAreaInput,
} from "@true-recall/obsidian/components";
import { NoteTypePicker } from "@true-recall/obsidian/modals/core/add-flashcards/NoteTypePicker";

import type { PluginSettingsProps } from "../types";

export function AIGenerationSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	const hasProKey = !!settings.proKey;

	return (
		<>
			<FormField
				name="Note type"
				description="Which note type to use for AI-generated flashcards. The AI fills all fields based on their names."
			>
				<NoteTypePicker
					value={settings.generationNoteTypeId ?? BUILTIN_BASIC_ID}
					onChange={(id) =>
						void save({
							generationNoteTypeId: id === BUILTIN_BASIC_ID ? null : id,
						})
					}
				/>
			</FormField>

			<FormField
				name="Generation prompt"
				description={
					hasProKey
						? "Extra instructions for flashcard generation. Pro already uses an optimized prompt — leave empty unless you want to override specific behavior."
						: "Extra instructions for flashcard generation. Added to the system prompt alongside JSON format rules."
				}
			>
				<TextAreaInput
					value={settings.aiGenerationPrompt ?? ""}
					onChange={(v) =>
						void save({
							aiGenerationPrompt: v.trim().length > 0 ? v : undefined,
						})
					}
					placeholder={
						hasProKey
							? "Leave empty for best results"
							: "e.g. Focus on key definitions and formulas"
					}
					rows={4}
					class="ep:w-full ep:font-mono ep:text-ui-smaller"
				/>
			</FormField>

			<FormField
				name="Generation language"
				description="Language for AI-generated flashcards. Auto-detect matches the source text language."
			>
				<SelectInput
					value={settings.generationLanguage ?? "auto"}
					onChange={(v) => void save({ generationLanguage: v })}
					options={[...GENERATION_LANGUAGES]}
				/>
			</FormField>
		</>
	);
}
