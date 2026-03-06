import {
	BackgroundBackupSection,
	BackupSettingsSection,
	BackupStatusSection,
	DeviceDatabaseSection,
	ImportExportSection,
	IntegrityCheckSection,
	ManualBackupSection,
	SmartRetentionSection,
} from "@features/settings/tabs/data";

export function DataTab() {
	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<DeviceDatabaseSection />
			<ManualBackupSection />
			<BackupSettingsSection />
			<BackgroundBackupSection />
			<SmartRetentionSection />
			<BackupStatusSection />
			<IntegrityCheckSection />
			<ImportExportSection />
		</div>
	);
}
