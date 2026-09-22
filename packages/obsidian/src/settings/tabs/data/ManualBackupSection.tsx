import {
	ActionButton,
	FormCard,
	FormField,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { useSettings } from "../../hooks/useSettings";

export function ManualBackupSection() {
	const { plugin } = useSettings();

	return (
		<FormCard title={t("Manual backup")}>
			<FormField
				name={t("Create backup now")}
				description={t("Manually create a backup of the current database")}
			>
				<ActionButton
					label={t("Create backup")}
					variant="primary"
					onClick={() => void plugin.createManualBackup()}
				/>
			</FormField>

			<FormField
				name={t("Restore from backup")}
				description={t(
					"Restore the database from a previous backup (requires Obsidian reload)",
				)}
			>
				<ActionButton
					label={t("Restore...")}
					variant="secondary"
					onClick={() => void plugin.openRestoreBackupModal()}
				/>
			</FormField>
		</FormCard>
	);
}
