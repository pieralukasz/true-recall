import { useSettings } from "@features/settings/hooks/useSettings";
import { Clickable, SettingRow } from "@shared/ui/components";

export function ImportExportSection() {
	const { plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Anki import / export" />

			<SettingRow
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
			</SettingRow>

			<SettingRow
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
			</SettingRow>

			<SettingRow
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
			</SettingRow>
		</>
	);
}
