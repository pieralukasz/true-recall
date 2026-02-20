import { useSettings } from "@features/settings/hooks/useSettings";
import type { BackupInterval } from "@shared/types";
import {
	InfoBlock,
	SelectInput,
	SettingRow,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";

export function BackgroundBackupSection() {
	const { settings, save } = useSettings();

	return (
		<>
			<SettingRow heading name="Background backup" />

			<InfoBlock>
				<p>
					Automatic periodic backups run in the background to protect your data.
				</p>
				<p>
					Smart retention keeps recent backups densely and older ones sparsely.
				</p>
			</InfoBlock>

			<SettingRow
				name="Enable periodic backups"
				description="Automatically backup database at regular intervals"
			>
				<ToggleInput
					value={settings.periodicBackupEnabled}
					onChange={(v) => save({ periodicBackupEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Backup interval"
				description="How often to create automatic backups (only when changes exist)"
			>
				<SelectInput
					value={String(settings.backupIntervalMinutes)}
					onChange={(v) =>
						save({ backupIntervalMinutes: parseInt(v, 10) as BackupInterval })
					}
					options={[
						{ value: "15", label: "Every 15 minutes" },
						{ value: "30", label: "Every 30 minutes" },
						{ value: "60", label: "Every hour" },
						{ value: "120", label: "Every 2 hours" },
						{ value: "240", label: "Every 4 hours" },
					]}
				/>
			</SettingRow>

			<SettingRow
				name="Activity-triggered backup"
				description="Create backup after completing a certain number of reviews"
			>
				<ToggleInput
					value={settings.activityTriggeredBackup}
					onChange={(v) => save({ activityTriggeredBackup: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Reviews before backup"
				description="Number of reviews after which to trigger an automatic backup"
			>
				<TextInput
					value={String(settings.reviewsBeforeBackup)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 50;
						void save({ reviewsBeforeBackup: Math.max(10, num) });
					}}
					placeholder="50"
				/>
			</SettingRow>
		</>
	);
}
