import { useEffect, useState } from "preact/hooks";

import { FormCard, InfoBlock } from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

import { useSettings } from "../../hooks/useSettings";
import { StatusList } from "./StatusList";

export function BackupStatusSection() {
	const { plugin } = useSettings();
	const manager = plugin.backgroundBackupManager;

	const [status, setStatus] = useState(() => manager?.getStatus());

	useEffect(() => {
		if (!manager) return;
		setStatus(manager.getStatus());
		const id = window.setInterval(() => setStatus(manager.getStatus()), 10_000);
		return () => window.clearInterval(id);
	}, [manager]);

	if (!manager || !status) return null;

	const lastBackup = status.lastBackupTime
		? new Date(status.lastBackupTime).toLocaleString()
		: "Never (this session)";
	const nextBackup = status.nextScheduledBackup
		? new Date(status.nextScheduledBackup).toLocaleString()
		: "Not scheduled";
	const sessionStartFilename = status.sessionStartBackupPath
		? status.sessionStartBackupPath.split("/").pop()
		: null;

	return (
		<FormCard title={t("Backup status")} class="tr-setting-section--status">
			<InfoBlock>
				{t(
					"Startup snapshot is a safety copy only. It does not restore or overwrite your active database.",
				)}
			</InfoBlock>
			<StatusList
				items={[
					{
						get label() {
							return t("Last backup");
						},
						value: lastBackup,
					},
					{
						get label() {
							return t("Next scheduled");
						},
						value: nextBackup,
					},
					{
						get label() {
							return t("Reviews since last backup");
						},
						value: status.reviewsSinceLastBackup,
						tone: status.reviewsSinceLastBackup === 0 ? "muted" : "default",
					},
					...(sessionStartFilename
						? [
								{
									get label() {
										return t("Startup snapshot");
									},
									value: sessionStartFilename,
									code: true,
									wide: true,
								} as const,
							]
						: []),
				]}
			/>
		</FormCard>
	);
}
