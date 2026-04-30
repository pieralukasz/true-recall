import { normalizePath } from "obsidian";
import { useCallback } from "preact/hooks";

import {
	ActionButton,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
} from "@true-recall/obsidian/components";
import { DeviceSelectionModal } from "@true-recall/obsidian/modals/integration/DeviceSelectionModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { DB_FOLDER, getDeviceDbFilename } from "@true-recall/core/persistence/sqlite/sqlite.types";

import { useSettings } from "../../hooks/useSettings";

export function DeviceDatabaseSection() {
	const { plugin } = useSettings();

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

			const targetPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(currentDeviceId)}`,
			);

			const sourceData = await plugin.app.vault.adapter.readBinary(
				result.sourcePath,
			);
			await plugin.app.vault.adapter.writeBinary(targetPath, sourceData);

			notify().success(
				`Imported data from device ${result.sourceDeviceId}. Please restart Obsidian.`,
			);
		} catch (error) {
			console.error("[True Recall] Database switch failed:", error);
			notify().error("Failed to switch database.");
		}
	}, [plugin]);

	return (
		<FormCard title="Device database">
			<InfoBlock>
				<p>
					Device ID: <code>{deviceId}</code>
				</p>
				<p>
					Database: <code>{`.true-recall/true-recall-${deviceId}.db`}</code>
				</p>
			</InfoBlock>

			<FormField
				name="Device name"
				description="Optional name (stored locally)"
			>
				<TextInput
					value={deviceLabel || ""}
					onChange={(v) => plugin.deviceIdService?.setDeviceLabel(v)}
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
		</FormCard>
	);
}
