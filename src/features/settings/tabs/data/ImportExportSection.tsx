import { useSettings } from "@features/settings/hooks/useSettings";
import { SettingRow } from "@shared/ui/components";

export function ImportExportSection() {
	const { plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Anki import / export" />

			<SettingRow
				name="Import Anki deck"
				description="Import flashcards from an Anki .apkg file with optional scheduling data"
			>
				<button
					type="button"
					class="mod-cta"
					onClick={() => plugin.importAnki()}
				>
					Import .apkg
				</button>
			</SettingRow>

			<SettingRow
				name="Export to Anki"
				description="Export your flashcards as an Anki-compatible .apkg file"
			>
				<button
					type="button"
					class="mod-cta"
					onClick={() => plugin.exportAnki()}
				>
					Export .apkg
				</button>
			</SettingRow>

			<SettingRow
				name="Export as CSV/TSV"
				description="Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools"
			>
				<button
					type="button"
					class="mod-cta"
					onClick={() => plugin.exportCsv()}
				>
					Export CSV
				</button>
			</SettingRow>
		</>
	);
}
