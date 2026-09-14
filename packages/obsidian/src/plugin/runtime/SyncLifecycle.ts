import { DeviceLockService } from "@true-recall/core/integration/device/device-lock.service";
import { DeviceSyncService } from "@true-recall/core/integration/device/device-sync.service";
import { DeviceSyncScheduler } from "@true-recall/core/integration/device/device-sync-scheduler";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { FsrsReplayService } from "@true-recall/core/services/fsrs/fsrs-replay.service";
import {
	extractFSRSSettings,
	extractFSRSSettingsFromPreset,
} from "@true-recall/core/types/settings.types";

import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import { G } from "@true-recall/obsidian/data";
import { CloudSyncManager } from "@true-recall/obsidian/features/integration/cloud/cloud-sync-manager";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import {
	CrossDeviceSyncCoordinator,
	emptySyncResult,
} from "@true-recall/obsidian/plugin/CrossDeviceSyncCoordinator";
import { reportError } from "@true-recall/obsidian/services/errors";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { setLastMutation } from "@true-recall/obsidian/services/signals";
import { isMobile } from "@true-recall/obsidian/utils/platform";
export class SyncLifecycle {
	private deviceLock: DeviceLockService | null = null;
	private deviceSyncScheduler: DeviceSyncScheduler | null = null;
	constructor(private plugin: TrueRecallPlugin) {}
	async initialize(): Promise<void> {
		// 3. Device lock (only when sync is enabled)
		if (
			this.plugin.settings.syncMode === "shared-vault" &&
			this.plugin.deviceIdService
		) {
			try {
				const persistence = new ObsidianPersistence(this.plugin.app);
				const deviceId = this.plugin.deviceIdService.getDeviceId();
				const label = this.plugin.deviceIdService.getDisplayName();
				this.deviceLock = new DeviceLockService(
					persistence,
					deviceId,
					isMobile() ? "mobile" : "desktop",
					label,
				);

				const conflicting = await this.deviceLock.isConflicting();
				if (conflicting) {
					notify().warning(
						`True Recall is open on ${conflicting.label} (${conflicting.platform}). Close it first to avoid sync issues.`,
					);
				}
				await this.deviceLock.writeLock();
				this.deviceLock.startHeartbeat();
			} catch (error) {
				reportError(error, { origin: "device-lock-setup" });
			}
		}

		// 4. Cross-device sync
		try {
			if (
				this.plugin.settings.syncMode === "shared-vault" &&
				this.plugin.deviceDiscovery &&
				this.plugin.cardStore
			) {
				// Replay resolves each log's FSRS settings by preset name; unknown
				// or missing names fall back to the current default preset.
				const resolvePresetSettings = (presetName: string | null) => {
					const preset = presetName
						? this.plugin.settings.fsrsPresets?.find(
								(p) => p.name === presetName,
							)
						: undefined;
					return preset
						? extractFSRSSettingsFromPreset(preset)
						: extractFSRSSettings(this.plugin.settings);
				};
				const replayService = new FsrsReplayService(
					new FSRSService(extractFSRSSettings(this.plugin.settings)),
					resolvePresetSettings,
				);
				const syncService = new DeviceSyncService(
					this.plugin.cardStore,
					this.plugin.deviceDiscovery,
					new ObsidianPersistence(this.plugin.app),
					{
						getDayStartHour: () => this.plugin.settings.dayStartHour,
						replayService,
					},
				);
				this.plugin.syncCoordinator = new CrossDeviceSyncCoordinator({
					runSync: () => syncService.syncOnStartup(),
					flushLocal: async () =>
						this.plugin.cardStore?.saveNow({ bestEffort: true }),
					onChangesApplied: (result) => {
						// Patch-first for open views (live review queues evict
						// remotely deleted cards), then group invalidation.
						if (result.cardIdsChanged.length > 0) {
							setLastMutation({
								type: "bulk",
								action: "update",
								cardIds: result.cardIdsChanged,
							});
						}
						this.plugin.dataLayer?.invalidateGroups([
							G.CARDS,
							G.BROWSER,
							G.DASHBOARD,
							G.PANEL,
							G.REVIEW,
							G.STATS,
						]);
					},
				});

				// Never awaited by onload: the startup merge flushes the local
				// database in full and reads every remote database in full (the
				// desktop DB alone is ~60 MB). On mobile with an iCloud vault that
				// read can stall on a network download, parking the whole app
				// behind "Plugin is taking long to load" until it finishes. Same
				// pattern as the device-import offer in PluginInitializers.
				this.plugin.app.workspace.onLayoutReady(() => {
					void (async () => {
						if (this.plugin.settings.syncMode !== "shared-vault") return;
						const syncResult =
							await this.plugin.syncCoordinator?.syncNow("startup");
						if (!syncResult) return;
						if (syncResult.errors.length > 0) {
							notify().warning(
								`Sync completed with ${syncResult.errors.length} error(s). Some changes may not have been applied.`,
							);
						}
						if (
							syncResult.cardsApplied > 0 ||
							syncResult.reviewLogsApplied > 0
						) {
							notify().info(
								`Synced ${syncResult.cardsApplied} cards and ${syncResult.reviewLogsApplied} reviews from other devices.`,
							);
						}
					})();
				});

				// Background merge: reviews done on another device show up without
				// restarting the plugin. Cheap mtime polling; the merge itself is
				// watermark-guarded, so no-change ticks cost nothing.
				if (this.plugin.deviceIdService) {
					this.deviceSyncScheduler = new DeviceSyncScheduler(
						new ObsidianPersistence(this.plugin.app),
						this.plugin.deviceIdService.getDeviceId(),
						async () =>
							this.plugin.settings.syncMode === "shared-vault"
								? ((await this.plugin.syncCoordinator?.syncNow("interval")) ??
									emptySyncResult())
								: emptySyncResult(),
					);
					this.plugin.app.workspace.onLayoutReady(() => {
						void this.deviceSyncScheduler?.start();
					});
				}

				// Mobile apps return from the background without reloading the
				// plugin, so startup-only sync would show stale data all day.
				// Re-check syncMode on every trigger: the user can switch to
				// Cloud Sync mid-session, and the two transports must never
				// run concurrently.
				this.plugin.registerDomEvent(activeDocument, "visibilitychange", () => {
					if (
						activeDocument.visibilityState === "visible" &&
						this.plugin.settings.syncMode === "shared-vault"
					) {
						void this.plugin.syncCoordinator?.syncNow("foreground");
					}
				});
			}
		} catch (error) {
			notify().error(
				"Cross-device sync failed. Your cards may not be up to date.",
				error,
			);
		}

		this.plugin.cloudSyncManager = new CloudSyncManager(this.plugin);
		this.plugin.cloudSyncManager.initialize();
	}
	stop(): void {
		this.deviceSyncScheduler?.stop();
		this.deviceSyncScheduler = null;
		this.deviceLock?.stopHeartbeat();
		void this.deviceLock?.clearLock();
		this.deviceLock = null;
		this.plugin.syncCoordinator = null;
	}
}
