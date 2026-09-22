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
import { MarkdownFlashcardsSection } from "./data/MarkdownFlashcardsSection";

export function DataTab() {
	return (
		<div class="tr-settings-sections">
			<MarkdownFlashcardsSection />
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
