import { useSettings } from "../../hooks/useSettings";
import type { BackupInterval } from "@shared/types";
import {
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";

export function BackgroundBackupSection() {
	const { settings, save } = useSettings();

	return (
		<FormCard title="Background backup">
			<InfoBlock>
				<p>
					Your active SQL database remains the source of truth during study and
					editing.
				</p>
				<p>Periodic backups run in the background as protection only.</p>
				<p>
					Smart retention keeps recent backups densely and older ones sparsely.
				</p>
			</InfoBlock>

			<FormField
				name="Enable periodic backups"
				description="Automatically backup database at regular intervals"
			>
				<ToggleInput
					value={settings.periodicBackupEnabled}
					onChange={(v) => void save({ periodicBackupEnabled: v })}
				/>
			</FormField>

			<FormField
				name="Backup interval"
				description="How often to create automatic backups (only when changes exist)"
			>
				<SelectInput
					value={String(settings.backupIntervalMinutes)}
					onChange={(v) =>
						void save({
							backupIntervalMinutes: parseInt(v, 10) as BackupInterval,
						})
					}
					options={[
						{ value: "15", label: "Every 15 minutes" },
						{ value: "30", label: "Every 30 minutes" },
						{ value: "60", label: "Every hour" },
						{ value: "120", label: "Every 2 hours" },
						{ value: "240", label: "Every 4 hours" },
					]}
				/>
			</FormField>

			<FormField
				name="Activity-triggered backup"
				description="Create backup after completing a certain number of reviews"
			>
				<ToggleInput
					value={settings.activityTriggeredBackup}
					onChange={(v) => void save({ activityTriggeredBackup: v })}
				/>
			</FormField>

			<FormField
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
			</FormField>
		</FormCard>
	);
}
