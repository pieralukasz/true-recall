import {
	BackgroundBackupSection,
	BackupSettingsSection,
	BackupStatusSection,
	ContentSection,
	DeviceDatabaseSection,
	ImportExportSection,
	ManualBackupSection,
	SmartRetentionSection,
} from "@features/settings/tabs/data";

export function DataTab() {
	return (
		<>
			<DeviceDatabaseSection />
			<BackupSettingsSection />
			<BackgroundBackupSection />
			<SmartRetentionSection />
			<BackupStatusSection />
			<ManualBackupSection />
			<ImportExportSection />
			<ContentSection />
		</>
	);
}
