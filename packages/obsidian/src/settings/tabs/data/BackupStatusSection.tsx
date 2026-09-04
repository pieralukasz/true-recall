import { useEffect, useState } from "preact/hooks";

import { FormCard, InfoBlock } from "@true-recall/obsidian/components";

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
		<FormCard title="Backup status" class="tr-setting-section--status">
			<InfoBlock>
				Startup snapshot is a safety copy only. It does not restore or overwrite
				your active database.
			</InfoBlock>
			<StatusList
				items={[
					{ label: "Last backup", value: lastBackup },
					{ label: "Next scheduled", value: nextBackup },
					{
						label: "Reviews since last backup",
						value: status.reviewsSinceLastBackup,
						tone: status.reviewsSinceLastBackup === 0 ? "muted" : "default",
					},
					...(sessionStartFilename
						? [
								{
									label: "Startup snapshot",
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
