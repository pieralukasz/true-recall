import { useSettings } from "@features/settings/hooks/useSettings";
import {
	FormCard,
	FormField,
	InfoBlock,
	ToggleInput,
} from "@shared/ui/components";

export function BackupSettingsSection() {
	const { settings, save } = useSettings();

	return (
		<FormCard title="Database backup">
			<InfoBlock>
				<p>Create backups of your flashcard database to prevent data loss.</p>
				<p>
					Backups are stored in <code>.true-recall/backups/</code>
				</p>
			</InfoBlock>

			<FormField
				name="Automatic backup on load"
				description="Create a backup automatically when the plugin loads"
			>
				<ToggleInput
					value={settings.autoBackupOnLoad}
					onChange={(v) => save({ autoBackupOnLoad: v })}
				/>
			</FormField>
		</FormCard>
	);
}
