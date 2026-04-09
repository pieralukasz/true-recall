import {
	ActionButton,
	FormCard,
	FormField,
} from "@true-recall/obsidian/components";

import { useSettings } from "../../hooks/useSettings";

export function ImportExportSection() {
	const { plugin } = useSettings();

	return (
		<FormCard title="Anki import / export">
			<FormField
				name="Import Anki deck"
				description="Import flashcards from an Anki .apkg file with optional scheduling data"
			>
				<ActionButton
					label="Import .apkg"
					variant="primary"
					onClick={() => void plugin.importAnki()}
				/>
			</FormField>

			<FormField
				name="Export to Anki"
				description="Export your flashcards as an Anki-compatible .apkg file"
			>
				<ActionButton
					label="Export .apkg"
					variant="primary"
					onClick={() => plugin.exportAnki()}
				/>
			</FormField>

			<FormField
				name="Export as CSV/TSV"
				description="Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools"
			>
				<ActionButton
					label="Export CSV"
					variant="primary"
					onClick={() => plugin.exportCsv()}
				/>
			</FormField>
		</FormCard>
	);
}
