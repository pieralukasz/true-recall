import { useState, useCallback } from "preact/hooks";
import {
	SettingRow,
	ToggleInput,
	TextInput,
	SliderInput,
	SelectInput,
	InfoBlock,
} from "../../preact/components";
import { useSettings } from "../hooks/useSettings";
import { notify } from "../../../services";
import { DeviceSelectionModal } from "../../modals";
import type { BackupInterval } from "../../../types";

function DeviceDatabaseSection() {
	const { settings, save, plugin } = useSettings();

	const deviceId = plugin.deviceIdService?.getDeviceId() || "unknown";
	const deviceLabel = plugin.deviceIdService?.getDeviceLabel();

	const handleSwitchDatabase = useCallback(async () => {
		if (!plugin.deviceDiscovery || !plugin.deviceIdService) {
			notify().error("Device services not initialized");
			return;
		}

		const databases = await plugin.deviceDiscovery.discoverDeviceDatabases();
		const otherDevices = databases.filter((db) => !db.isCurrentDevice);

		if (otherDevices.length === 0) {
			notify().info("No other device databases available to import");
			return;
		}

		const modal = new DeviceSelectionModal(plugin.app, {
			databases: otherDevices,
			hasLegacy: false,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.action !== "import" || !result.sourcePath) {
			return;
		}

		// eslint-disable-next-line no-alert
		const confirmed = confirm(
			`Are you sure you want to replace the current database with data from device ${result.sourceDeviceId}?\n\nThe current database will be overwritten. This requires restarting Obsidian.`,
		);

		if (!confirmed) return;

		try {
			const currentDeviceId = plugin.deviceIdService!.getDeviceId();
			const { normalizePath } = await import("obsidian");
			const { DB_FOLDER, getDeviceDbFilename } = await import(
				"../../../services/persistence/sqlite/sqlite.types"
			);

			const targetPath = normalizePath(`${DB_FOLDER}/${getDeviceDbFilename(currentDeviceId)}`);
			const backupPath = normalizePath(`${DB_FOLDER}/${getDeviceDbFilename(currentDeviceId)}.backup`);
			const currentData = await plugin.app.vault.adapter.readBinary(targetPath);
			await plugin.app.vault.adapter.writeBinary(backupPath, currentData);

			const sourceData = await plugin.app.vault.adapter.readBinary(result.sourcePath);
			await plugin.app.vault.adapter.writeBinary(targetPath, sourceData);

			notify().success(`Imported data from device ${result.sourceDeviceId}. Please restart Obsidian.`);
		} catch (error) {
			console.error("[True Recall] Database switch failed:", error);
			notify().error("Failed to switch database.");
		}
	}, [plugin]);

	return (
		<>
			<SettingRow heading name="Device database" />

			<InfoBlock>
				<p>
					Device ID: <code>{deviceId}</code>
				</p>
				<p>
					Database: <code>{`.true-recall/true-recall-${deviceId}.db`}</code>
				</p>
			</InfoBlock>

			<SettingRow name="Device name" description="Optional name (stored locally)">
				<TextInput
					value={deviceLabel || ""}
					onChange={(v) => plugin.deviceIdService?.setDeviceLabel(v)}
					placeholder="e.g., work laptop, phone"
				/>
			</SettingRow>

			<SettingRow name="Switch database" description="Import data from another device">
				<button class="mod-cta" onClick={handleSwitchDatabase}>
					Switch...
				</button>
			</SettingRow>
		</>
	);
}

function BackupSettingsSection() {
	const { settings, save } = useSettings();

	return (
		<>
			<SettingRow heading name="Database backup" />

			<InfoBlock>
				<p>Create backups of your flashcard database to prevent data loss.</p>
				<p>
					Backups are stored in <code>.true-recall/backups/</code>
				</p>
			</InfoBlock>

			<SettingRow
				name="Automatic backup on load"
				description="Create a backup automatically when the plugin loads"
			>
				<ToggleInput
					value={settings.autoBackupOnLoad}
					onChange={(v) => save({ autoBackupOnLoad: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Maximum backups to keep (legacy)"
				description="Simple retention: keep last N backups. Use smart retention below for better control."
			>
				<TextInput
					value={String(settings.maxBackups)}
					onChange={(v) => {
						const num = parseInt(v) || 0;
						void save({ maxBackups: Math.max(0, num) });
					}}
					placeholder="10"
				/>
			</SettingRow>
		</>
	);
}

function BackgroundBackupSection() {
	const { settings, save, plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Background backup" />

			<InfoBlock>
				<p>Automatic periodic backups run in the background to protect your data.</p>
				<p>Smart retention keeps recent backups densely and older ones sparsely.</p>
			</InfoBlock>

			<SettingRow
				name="Enable periodic backups"
				description="Automatically backup database at regular intervals"
			>
				<ToggleInput
					value={settings.periodicBackupEnabled}
					onChange={(v) => save({ periodicBackupEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Backup interval"
				description="How often to create automatic backups (only when changes exist)"
			>
				<SelectInput
					value={String(settings.backupIntervalMinutes)}
					onChange={(v) => save({ backupIntervalMinutes: parseInt(v) as BackupInterval })}
					options={[
						{ value: "15", label: "Every 15 minutes" },
						{ value: "30", label: "Every 30 minutes" },
						{ value: "60", label: "Every hour" },
						{ value: "120", label: "Every 2 hours" },
						{ value: "240", label: "Every 4 hours" },
					]}
				/>
			</SettingRow>

			<SettingRow
				name="Activity-triggered backup"
				description="Create backup after completing a certain number of reviews"
			>
				<ToggleInput
					value={settings.activityTriggeredBackup}
					onChange={(v) => save({ activityTriggeredBackup: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Reviews before backup"
				description="Number of reviews after which to trigger an automatic backup"
			>
				<TextInput
					value={String(settings.reviewsBeforeBackup)}
					onChange={(v) => {
						const num = parseInt(v) || 50;
						void save({ reviewsBeforeBackup: Math.max(10, num) });
					}}
					placeholder="50"
				/>
			</SettingRow>
		</>
	);
}

function SmartRetentionSection() {
	const { settings, save } = useSettings();
	const { hourlyBackupsToKeep, dailyBackupsToKeep, weeklyBackupsToKeep } = settings.retentionPolicy;

	return (
		<>
			<SettingRow heading name="Smart retention" />

			<InfoBlock>
				<p>Multi-tier retention keeps recent backups densely and older ones sparsely.</p>
				<p>
					Current policy:{" "}
					<strong>
						{hourlyBackupsToKeep}h / {dailyBackupsToKeep}d / {weeklyBackupsToKeep}w
					</strong>
				</p>
			</InfoBlock>

			<SettingRow
				name="Hourly backups"
				description="Keep one backup per hour for the last N hours (0 = disabled)"
			>
				<SliderInput
					value={settings.retentionPolicy.hourlyBackupsToKeep}
					onChange={(v) =>
						save({ retentionPolicy: { ...settings.retentionPolicy, hourlyBackupsToKeep: v } })
					}
					min={0}
					max={48}
					step={1}
				/>
			</SettingRow>

			<SettingRow
				name="Daily backups"
				description="Keep one backup per day for the last N days (0 = disabled)"
			>
				<SliderInput
					value={settings.retentionPolicy.dailyBackupsToKeep}
					onChange={(v) =>
						save({ retentionPolicy: { ...settings.retentionPolicy, dailyBackupsToKeep: v } })
					}
					min={0}
					max={30}
					step={1}
				/>
			</SettingRow>

			<SettingRow
				name="Weekly backups"
				description="Keep one backup per week for the last N weeks (0 = disabled)"
			>
				<SliderInput
					value={settings.retentionPolicy.weeklyBackupsToKeep}
					onChange={(v) =>
						save({ retentionPolicy: { ...settings.retentionPolicy, weeklyBackupsToKeep: v } })
					}
					min={0}
					max={12}
					step={1}
				/>
			</SettingRow>
		</>
	);
}

function BackupStatusSection() {
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

function ManualBackupSection() {
	const { plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Manual backup" />

			<SettingRow
				name="Create backup now"
				description="Manually create a backup of the current database"
			>
				<button class="mod-cta" onClick={() => plugin.createManualBackup()}>
					Create backup
				</button>
			</SettingRow>

			<SettingRow
				name="Restore from backup"
				description="Restore the database from a previous backup (requires Obsidian reload)"
			>
				<button class="mod-warning" onClick={() => plugin.openRestoreBackupModal()}>
					Restore...
				</button>
			</SettingRow>
		</>
	);
}

function ImportExportSection() {
	const { plugin } = useSettings();

	return (
		<>
			<SettingRow heading name="Anki import / export" />

			<SettingRow
				name="Import Anki deck"
				description="Import flashcards from an Anki .apkg file with optional scheduling data"
			>
				<button class="mod-cta" onClick={() => plugin.importAnki()}>
					Import .apkg
				</button>
			</SettingRow>

			<SettingRow
				name="Export to Anki"
				description="Export your flashcards as an Anki-compatible .apkg file"
			>
				<button class="mod-cta" onClick={() => plugin.exportAnki()}>
					Export .apkg
				</button>
			</SettingRow>

			<SettingRow
				name="Export as CSV/TSV"
				description="Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools"
			>
				<button class="mod-cta" onClick={() => plugin.exportCsv()}>
					Export CSV
				</button>
			</SettingRow>
		</>
	);
}

function ContentSection() {
	const { settings, save } = useSettings();

	return (
		<>
			<SettingRow heading name="Content" />

			<SettingRow
				name="Excluded folders"
				description="Comma-separated list of folders to exclude from flashcard search"
			>
				<TextInput
					value={settings.excludedFolders.join(", ")}
					onChange={(v) => {
						const folders = v
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						void save({ excludedFolders: folders });
					}}
					placeholder="templates, archive"
				/>
			</SettingRow>
		</>
	);
}

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
