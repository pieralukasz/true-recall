import {
	ActionButton,
	FormCard,
	FormField,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { useSettings } from "../../hooks/useSettings";

export function ImportExportSection() {
	const { plugin } = useSettings();

	return (
		<FormCard
			title={t("Anki import & export")}
			description={t(
				"Move decks between Anki and True Recall. AI enhancement is not required.",
			)}
		>
			<FormField
				name={t("Import Anki deck")}
				description={t(
					"Import flashcards from an Anki .apkg file with optional scheduling data",
				)}
			>
				<ActionButton
					label={t("Import .apkg")}
					variant="primary"
					onClick={() => void plugin.importAnki()}
				/>
			</FormField>

			<FormField
				name={t("Export to Anki")}
				description={t(
					"Export your flashcards as an Anki-compatible .apkg file",
				)}
			>
				<ActionButton
					label={t("Export .apkg")}
					variant="primary"
					onClick={() => plugin.exportAnki()}
				/>
			</FormField>

			<FormField
				name={t("Export as CSV/TSV")}
				description={t(
					"Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools",
				)}
			>
				<ActionButton
					label={t("Export CSV")}
					variant="primary"
					onClick={() => plugin.exportCsv()}
				/>
			</FormField>
		</FormCard>
	);
}
