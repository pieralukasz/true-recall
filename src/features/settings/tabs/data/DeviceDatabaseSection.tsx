import { DeviceSelectionModal } from "@features/integration/modals/DeviceSelectionModal";
import { useSettings } from "@features/settings/hooks/useSettings";
import { notify } from "@shared/services/notification.service";
import { InfoBlock, SettingRow, TextInput } from "@shared/ui/components";
import { useCallback } from "preact/hooks";

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

		// eslint-disable-next-line no-alert
		const confirmed = confirm(
			`Are you sure you want to replace the current database with data from device ${result.sourceDeviceId}?\n\nThe current database will be overwritten. This requires restarting Obsidian.`,
		);

		if (!confirmed) return;

		try {
			const currentDeviceId = plugin.deviceIdService?.getDeviceId();
			const { normalizePath } = await import("obsidian");
			const { DB_FOLDER, getDeviceDbFilename } = await import(
				"../../../../features/core/persistence/sqlite/sqlite.types"
			);

			const targetPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(currentDeviceId)}`,
			);
			const backupPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(currentDeviceId)}.backup`,
			);
			const currentData = await plugin.app.vault.adapter.readBinary(targetPath);
			await plugin.app.vault.adapter.writeBinary(backupPath, currentData);

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

			<SettingRow
				name="Device name"
				description="Optional name (stored locally)"
			>
				<TextInput
					value={deviceLabel || ""}
					onChange={(v) => plugin.deviceIdService?.setDeviceLabel(v)}
					placeholder="e.g., work laptop, phone"
				/>
			</SettingRow>

			<SettingRow
				name="Switch database"
				description="Import data from another device"
			>
				<button type="button" class="mod-cta" onClick={handleSwitchDatabase}>
					Switch...
				</button>
			</SettingRow>
		</>
	);
}
