import {
	BackgroundBackupSection,
	BackupSettingsSection,
	BackupStatusSection,
	DeviceDatabaseSection,
	ImportExportSection,
	ManualBackupSection,
	SmartRetentionSection,
} from "@features/settings/tabs/data";

export function DataTab() {
	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<DeviceDatabaseSection />
			<BackupSettingsSection />
			<BackgroundBackupSection />
			<SmartRetentionSection />
			<BackupStatusSection />
			<ManualBackupSection />
			<ImportExportSection />
		</div>
	);
}
