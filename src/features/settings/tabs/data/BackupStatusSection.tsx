import { useSettings } from "@features/settings/hooks/useSettings";
import { InfoBlock } from "@shared/ui/components";

export function BackupStatusSection() {
	const { plugin } = useSettings();

	if (!plugin.backgroundBackupManager) return null;

	const status = plugin.backgroundBackupManager.getStatus();
	const lastBackup = status.lastBackupTime
		? new Date(status.lastBackupTime).toLocaleString()
		: "Never (this session)";
	const nextBackup = status.nextScheduledBackup
		? new Date(status.nextScheduledBackup).toLocaleString()
		: "Not scheduled";

	return (
		<InfoBlock class="ep:mt-4">
			<p>
				<strong>Backup status:</strong>
			</p>
			<p>Last backup: {lastBackup}</p>
			<p>Next scheduled: {nextBackup}</p>
			<p>Reviews since last backup: {status.reviewsSinceLastBackup}</p>
		</InfoBlock>
	);
}
