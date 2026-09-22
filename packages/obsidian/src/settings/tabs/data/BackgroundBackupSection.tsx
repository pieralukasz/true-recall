import type { BackupInterval } from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { useSettings } from "../../hooks/useSettings";

export function BackgroundBackupSection() {
	const { settings, save } = useSettings();

	return (
		<FormCard title={t("Background backup")}>
			<InfoBlock>
				<p>
					{t(
						"Your active SQL database remains the source of truth during study and editing.",
					)}
				</p>
				<p>{t("Periodic backups run in the background as protection only.")}</p>
				<p>
					{t(
						"Smart retention keeps recent backups densely and older ones sparsely.",
					)}
				</p>
			</InfoBlock>

			<FormField
				name={t("Enable periodic backups")}
				description={t("Automatically backup database at regular intervals")}
			>
				<ToggleInput
					value={settings.periodicBackupEnabled}
					onChange={(v) => void save({ periodicBackupEnabled: v })}
				/>
			</FormField>

			<FormField
				name={t("Backup interval")}
				description={t(
					"How often to create automatic backups (only when changes exist)",
				)}
			>
				<SelectInput
					value={String(settings.backupIntervalMinutes)}
					onChange={(v) =>
						void save({
							backupIntervalMinutes: parseInt(v, 10) as BackupInterval,
						})
					}
					options={[
						{
							value: "15",
							get label() {
								return t("Every 15 minutes");
							},
						},
						{
							value: "30",
							get label() {
								return t("Every 30 minutes");
							},
						},
						{
							value: "60",
							get label() {
								return t("Every hour");
							},
						},
						{
							value: "120",
							get label() {
								return t("Every 2 hours");
							},
						},
						{
							value: "240",
							get label() {
								return t("Every 4 hours");
							},
						},
					]}
				/>
			</FormField>

			<FormField
				name={t("Activity-triggered backup")}
				description={t(
					"Create backup after completing a certain number of reviews",
				)}
			>
				<ToggleInput
					value={settings.activityTriggeredBackup}
					onChange={(v) => void save({ activityTriggeredBackup: v })}
				/>
			</FormField>

			<FormField
				name={t("Reviews before backup")}
				description={t(
					"Number of reviews after which to trigger an automatic backup",
				)}
			>
				<TextInput
					value={String(settings.reviewsBeforeBackup)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 50;
						void save({ reviewsBeforeBackup: Math.max(10, num) });
					}}
					placeholder="50"
					class="tr-control--compact"
				/>
			</FormField>
		</FormCard>
	);
}
