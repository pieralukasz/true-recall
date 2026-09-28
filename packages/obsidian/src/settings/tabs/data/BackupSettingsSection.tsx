import {
	BACKUPS_FOLDER,
	DB_FOLDER,
} from "@true-recall/core/persistence/sqlite/sqlite.types";

import {
	FormCard,
	FormField,
	InfoBlock,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { useSettings } from "../../hooks/useSettings";

export function BackupSettingsSection() {
	const { settings, save } = useSettings();

	return (
		<FormCard title={t("Database backup")}>
			<InfoBlock>
				<p>
					{t(
						"True Recall works directly on your active SQLite database during normal use.",
					)}
				</p>
				<p>
					{t(
						"Backups are safety copies to recover from corruption or accidental changes.",
					)}
				</p>
				<p>
					{t("Stored in")}{" "}
					<code>{`${DB_FOLDER}/${BACKUPS_FOLDER}/<device-id>/`}</code>
				</p>
			</InfoBlock>

			<FormField
				name={t("Automatic backup on load")}
				description={t("Create a backup automatically when the plugin loads")}
			>
				<ToggleInput
					value={settings.autoBackupOnLoad}
					onChange={(v) => void save({ autoBackupOnLoad: v })}
				/>
			</FormField>
		</FormCard>
	);
}
