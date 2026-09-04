import { normalizePath } from "obsidian";
import { useCallback } from "preact/hooks";

import {
	getDbBakPath,
	getDbTmpPath,
	writeDbFileAtomically,
} from "@true-recall/core/persistence/sqlite/atomic-db-file";

import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
} from "@true-recall/obsidian/components";
import { DeviceSelectionModal } from "@true-recall/obsidian/modals/integration/DeviceSelectionModal";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { useSettings } from "../../hooks/useSettings";

export function DeviceDatabaseSection() {
	const { plugin } = useSettings();

	const deviceId = plugin.deviceIdService?.getDeviceId() || "unknown";
	const deviceLabel = plugin.deviceIdService?.getDeviceLabel();
	const databasePath = plugin.deviceIdService
		? plugin.getDeviceDbPath(deviceId)
		: "unknown";

	const handleSwitchDatabase = useCallback(async () => {
		if (!plugin.deviceDiscovery || !plugin.deviceIdService) {
			notify().error("Device services not initialized");
			return;
		}

		// Explicit user action on a settings screen: worth reading the files to
		// show card counts, so the picker is not just sizes and dates.
		const databases = await plugin.deviceDiscovery.discoverDeviceDatabases({
			withStats: true,
		});
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

		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);
		const confirmed = await confirm(plugin.app, {
			message: `Are you sure you want to replace the current database with data from device ${result.sourceDeviceId}?\n\nThe current database will be overwritten. This requires restarting Obsidian.`,
		});

		if (!confirmed) return;

		try {
			// Safety backup before database switch
			await plugin.backupService?.createBackup();

			const currentDeviceId = plugin.deviceIdService?.getDeviceId();
			if (!currentDeviceId) throw new Error("Device id is not initialized");

			const targetPath = normalizePath(plugin.getDeviceDbPath(currentDeviceId));

			const sourceData = await plugin.app.vault.adapter.readBinary(
				result.sourcePath,
			);

			// The in-memory store must never flush again: its debounced or
			// safety-interval save would overwrite the imported file with the
			// pre-import state before the user restarts.
			plugin.cardStore?.haltPersistence();

			// Atomic swap: an interrupted import must not leave a truncated
			// live database behind.
			await writeDbFileAtomically(
				new ObsidianPersistence(plugin.app),
				targetPath,
				sourceData,
			);

			notify().success(
				`Imported data from device ${result.sourceDeviceId}. Please restart Obsidian.`,
			);
		} catch (error) {
			console.error("[True Recall] Database switch failed:", error);
			notify().error("Failed to switch database.");
		}
	}, [plugin]);

	const handleStartFresh = useCallback(async () => {
		const currentDeviceId = plugin.deviceIdService?.getDeviceId();
		if (!currentDeviceId) {
			notify().error("Device services not initialized");
			return;
		}
		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);
		const confirmed = await confirm(plugin.app, {
			message:
				"Delete this device's database and start empty?\n\nUse this when the database on this device cannot be loaded or holds a stale copy. With Cloud Sync connected, the next start downloads your collection from the account. Other devices are not affected. This requires restarting Obsidian.",
			confirmLabel: "Delete and start fresh",
		});
		if (!confirmed) return;

		try {
			await plugin.backupService?.createBackup().catch(() => undefined);
			// The in-memory store must never flush again: a debounced save would
			// recreate the file we are about to delete.
			plugin.cardStore?.haltPersistence();
			const persistence = new ObsidianPersistence(plugin.app);
			const dbPath = normalizePath(plugin.getDeviceDbPath(currentDeviceId));
			for (const path of [getDbTmpPath(dbPath), dbPath, getDbBakPath(dbPath)]) {
				if (await persistence.exists(path)) await persistence.remove(path);
			}
			notify().success(
				"Database removed. Restart Obsidian to start with an empty database.",
			);
		} catch (error) {
			console.error("[True Recall] Database reset failed:", error);
			notify().error("Failed to delete the database.");
		}
	}, [plugin]);

	return (
		<FormCard title="Device database">
			<InfoBlock>
				<p>
					Device ID: <code>{deviceId}</code>
				</p>
				<p>
					Database: <code>{databasePath}</code>
				</p>
			</InfoBlock>

			<FormField
				name="Device name"
				description="Optional name (stored locally)"
			>
				<TextInput
					value={deviceLabel || ""}
					onChange={(v) => {
						plugin.deviceIdService?.setDeviceLabel(v);
						const label = plugin.deviceIdService?.getDeviceLabel() ?? "";
						plugin.coreApp.cardStore?.cards.setSyncMetadataIfChanged(
							"device:label",
							label,
						);
					}}
					placeholder="e.g., work laptop, phone"
				/>
			</FormField>

			<FormField
				name="Switch database"
				description="Import data from another device"
			>
				<ActionButton
					label="Switch..."
					variant="primary"
					onClick={() => void handleSwitchDatabase()}
				/>
			</FormField>

			<FormField
				name="Start fresh"
				description="Delete this device's database. With Cloud Sync connected, the collection is downloaded again on the next start."
			>
				<ActionButton
					label="Delete database…"
					variant="danger"
					onClick={() => void handleStartFresh()}
				/>
			</FormField>
		</FormCard>
	);
}
