import { useSettings } from "../../hooks/useSettings";
import { ActionButton, FormCard, FormField } from "@shared/ui/components";

export function ManualBackupSection() {
	const { plugin } = useSettings();

	return (
		<FormCard title="Manual backup">
			<FormField
				name="Create backup now"
				description="Manually create a backup of the current database"
			>
				<ActionButton
					label="Create backup"
					variant="primary"
					onClick={() => void plugin.createManualBackup()}
				/>
			</FormField>

			<FormField
				name="Restore from backup"
				description="Restore the database from a previous backup (requires Obsidian reload)"
			>
				<ActionButton
					label="Restore..."
					variant="danger"
					onClick={() => void plugin.openRestoreBackupModal()}
				/>
			</FormField>
		</FormCard>
	);
}
