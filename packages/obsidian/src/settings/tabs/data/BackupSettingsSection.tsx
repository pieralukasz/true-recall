import {
	FormCard,
	FormField,
	InfoBlock,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { useSettings } from "../../hooks/useSettings";

export function BackupSettingsSection() {
	const { settings, save } = useSettings();

	return (
		<FormCard title="Database backup">
			<InfoBlock>
				<p>
					True Recall works directly on your active SQLite database during
					normal use.
				</p>
				<p>
					Backups are safety copies to recover from corruption or accidental
					changes.
				</p>
				<p>
					Stored in <code>.true-recall/backups/</code>
				</p>
			</InfoBlock>

			<FormField
				name="Automatic backup on load"
				description="Create a backup automatically when the plugin loads"
			>
				<ToggleInput
					value={settings.autoBackupOnLoad}
					onChange={(v) => void save({ autoBackupOnLoad: v })}
				/>
			</FormField>
		</FormCard>
	);
}
