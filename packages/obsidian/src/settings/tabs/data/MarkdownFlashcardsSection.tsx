import { useState } from "preact/hooks";

import {
	DEFAULT_MARKDOWN_FLASHCARDS,
	MarkdownFlashcardsSettingsSchema,
} from "@true-recall/core/flashcard/markdown/settings";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { useSettings } from "../../hooks/useSettings";

export function MarkdownFlashcardsSection() {
	const { settings, save } = useSettings();
	const config = settings.markdownFlashcards ?? DEFAULT_MARKDOWN_FLASHCARDS;
	const [draft, setDraft] = useState(config);
	const apply = async () => {
		const parsed = MarkdownFlashcardsSettingsSchema.safeParse(draft);
		if (!parsed.success) {
			notify().error(
				parsed.error.issues[0]?.message ??
					"Invalid Markdown flashcard settings",
			);
			return;
		}
		await save({ markdownFlashcards: parsed.data });
		notify().success("Markdown flashcard settings saved");
	};
	return (
		<FormCard title="Markdown flashcards">
			<InfoBlock>
				<p>
					Write cards in notes tagged #flashcards. Put ?? on its own line
					between question and answer, or ??? for a reversed pair. Separate
					cards with a blank line. Edit questions and answers here in Obsidian
					or in the source note; changes sync both ways.
				</p>
				<p>
					True Recall adds a hidden ID comment after each answer. Keep it with
					the card when editing or reordering cards in the same note. Remove it
					when copying a card. Removing a card from the note removes it from
					review; disabling this feature or removing the tag leaves existing
					cards intact.
				</p>
				<p>
					If the same field is changed differently in the note and panel, both
					versions are kept and sync reports a conflict. Make that field match
					in both places to resume syncing.
				</p>
			</InfoBlock>
			<FormField name="Enable Markdown flashcards">
				<ToggleInput
					value={draft.enabled}
					onChange={(enabled) => setDraft({ ...draft, enabled })}
				/>
			</FormField>
			<FormField
				name="Note tag"
				description="Without #. Inline tags and frontmatter tags are supported."
			>
				<TextInput
					value={draft.tag}
					onChange={(tag) => setDraft({ ...draft, tag })}
				/>
			</FormField>
			<FormField name="Normal card separator">
				<TextInput
					value={draft.basicSeparator}
					onChange={(basicSeparator) => setDraft({ ...draft, basicSeparator })}
				/>
			</FormField>
			<FormField
				name="Reversible card separator"
				description="Update existing notes when changing separators; unrecognized markers stop that note's import."
			>
				<TextInput
					value={draft.reversedSeparator}
					onChange={(reversedSeparator) =>
						setDraft({ ...draft, reversedSeparator })
					}
				/>
			</FormField>
			<FormField
				name="Store scheduling inside notes"
				description="Include FSRS state in the hidden comments for portability. SQLite remains the working database. Newer scheduling wins when importing; review logs and statistics remain in the database. When off, existing comments are retained but no scheduling is imported or written."
			>
				<ToggleInput
					value={draft.storeScheduling}
					onChange={(storeScheduling) =>
						setDraft({ ...draft, storeScheduling })
					}
				/>
			</FormField>
			<Clickable class="mod-cta" onClick={() => void apply()}>
				Apply Markdown settings
			</Clickable>
		</FormCard>
	);
}
