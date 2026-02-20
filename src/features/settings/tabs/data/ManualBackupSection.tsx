import { SettingRow } from "@shared/ui/components";
import { useSettings } from "@features/settings/hooks/useSettings";

export function ManualBackupSection() {
	const { plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Manual backup" />

			<SettingRow
				name="Create backup now"
				description="Manually create a backup of the current database"
			>
				<button
					type="button"
					class="mod-cta"
					onClick={() => plugin.createManualBackup()}
				>
					Create backup
				</button>
			</SettingRow>

			<SettingRow
				name="Restore from backup"
				description="Restore the database from a previous backup (requires Obsidian reload)"
			>
				<button
					type="button"
					class="mod-warning"
					onClick={() => plugin.openRestoreBackupModal()}
				>
					Restore...
				</button>
			</SettingRow>
		</>
	);
}
