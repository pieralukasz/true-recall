import { useSettings } from "@features/settings/hooks/useSettings";
import { Clickable, FormCard, FormField } from "@shared/ui/components";

export function ImportExportSection() {
	const { plugin } = useSettings();

	return (
		<FormCard title="Anki import / export">
			<FormField
				name="Import Anki deck"
				description="Import flashcards from an Anki .apkg file with optional scheduling data"
			>
				<Clickable
					class="mod-cta"
					stopPropagation={false}
					onClick={() => plugin.importAnki()}
				>
					Import .apkg
				</Clickable>
			</FormField>

			<FormField
				name="Export to Anki"
				description="Export your flashcards as an Anki-compatible .apkg file"
			>
				<Clickable
					class="mod-cta"
					stopPropagation={false}
					onClick={() => plugin.exportAnki()}
				>
					Export .apkg
				</Clickable>
			</FormField>

			<FormField
				name="Export as CSV/TSV"
				description="Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools"
			>
				<Clickable
					class="mod-cta"
					stopPropagation={false}
					onClick={() => plugin.exportCsv()}
				>
					Export CSV
				</Clickable>
			</FormField>
		</FormCard>
	);
}
