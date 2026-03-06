import { useSettings } from "@features/settings/hooks/useSettings";
import { FormCard } from "@shared/ui/components";
import { useEffect, useState } from "preact/hooks";

export function BackupStatusSection() {
	const { plugin } = useSettings();
	const manager = plugin.backgroundBackupManager;

	const [status, setStatus] = useState(() => manager?.getStatus());

	useEffect(() => {
		if (!manager) return;
		setStatus(manager.getStatus());
		const id = setInterval(() => setStatus(manager.getStatus()), 10_000);
		return () => clearInterval(id);
	}, [manager]);

	if (!manager || !status) return null;

	const lastBackup = status.lastBackupTime
		? new Date(status.lastBackupTime).toLocaleString()
		: "Never (this session)";
	const nextBackup = status.nextScheduledBackup
		? new Date(status.nextScheduledBackup).toLocaleString()
		: "Not scheduled";

	return (
		<FormCard title="Backup status">
			<p>Last backup: {lastBackup}</p>
			<p>Next scheduled: {nextBackup}</p>
			<p>Reviews since last backup: {status.reviewsSinceLastBackup}</p>
		</FormCard>
	);
}
