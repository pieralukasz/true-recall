import {
	BackgroundBackupSection,
	BackupSettingsSection,
	BackupStatusSection,
	ContentSection,
	DeviceDatabaseSection,
	ImportExportSection,
	ManualBackupSection,
	SmartRetentionSection,
} from "./data";

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
