import {
	BackgroundBackupSection,
	BackupSettingsSection,
	BackupStatusSection,
	DeviceDatabaseSection,
	ImportExportSection,
	IntegrityCheckSection,
	ManualBackupSection,
	SmartRetentionSection,
	StorageDiagnosticsSection,
	StorageLocationsSection,
} from "./data";

export function DataTab() {
	return (
		<div class="tr-settings-sections">
			<DeviceDatabaseSection />
			<StorageLocationsSection />
			<ManualBackupSection />
			<BackupSettingsSection />
			<BackgroundBackupSection />
			<SmartRetentionSection />
			<BackupStatusSection />
			<StorageDiagnosticsSection />
			<IntegrityCheckSection />
			<ImportExportSection />
		</div>
	);
}
