import { useSettings } from "@features/settings/hooks/useSettings";
import { Clickable, SettingRow } from "@shared/ui/components";

export function ManualBackupSection() {
	const { plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Manual backup" />

			<SettingRow
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
			</SettingRow>

			<SettingRow
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
			</SettingRow>
		</>
	);
}
