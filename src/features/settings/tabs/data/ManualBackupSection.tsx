import { useSettings } from "@features/settings/hooks/useSettings";
import { Clickable, FormCard, FormField } from "@shared/ui/components";

export function ManualBackupSection() {
	const { plugin } = useSettings();

	return (
		<FormCard title="Manual backup">
			<FormField
				name="Create backup now"
				description="Manually create a backup of the current database"
			>
				<Clickable
					class="mod-cta"
					stopPropagation={false}
					onClick={() => plugin.createManualBackup()}
				>
					Create backup
				</Clickable>
			</FormField>

			<FormField
				name="Restore from backup"
				description="Restore the database from a previous backup (requires Obsidian reload)"
			>
				<Clickable
					class="mod-warning"
					stopPropagation={false}
					onClick={() => plugin.openRestoreBackupModal()}
				>
					Restore...
				</Clickable>
			</FormField>
		</FormCard>
	);
}
