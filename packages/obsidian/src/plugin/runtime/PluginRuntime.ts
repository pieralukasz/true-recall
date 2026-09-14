import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { startLocalApi } from "@true-recall/obsidian/plugin/api/start-local-api";
import {
	checkForWhatsNew,
	initializeDeviceAndStore,
} from "@true-recall/obsidian/plugin/PluginInitializers";
import {
	NOTIFICATION_DURATION,
	notify,
} from "@true-recall/obsidian/services/notification.service";
import { capabilities } from "@true-recall/obsidian/utils/platform";

import { registerFeatures } from "./FeatureRegistry";
import { initializeCoreStorage } from "./StorageLifecycle";
import { SyncLifecycle } from "./SyncLifecycle";
export class PluginRuntime {
	private sync: SyncLifecycle;
	constructor(
		private plugin: TrueRecallPlugin,
		private isUnloaded: () => boolean,
	) {
		this.sync = new SyncLifecycle(plugin);
	}
	async load(): Promise<void> {
		const plugin = this.plugin;

		const t0 = performance.now();

		try {
			await initializeCoreStorage(plugin);
		} catch (error) {
			notify().error(
				"True Recall failed to initialize. Try reinstalling the plugin.",
				error,
			);
			return;
		}

		// What's New check after layout ready
		plugin.app.workspace.onLayoutReady(() => {
			checkForWhatsNew(plugin).catch((e) => {
				console.debug("[True Recall] What's New check failed:", e);
			});
		});

		const tSetup = performance.now();

		// 2. Initialize device context + card store
		try {
			await initializeDeviceAndStore(plugin);
		} catch (error) {
			notify().error(
				"True Recall could not load the database. Restore a backup in Settings → Data & Backup, then restart Obsidian.",
				error,
				NOTIFICATION_DURATION.PERSIST,
			);
			return;
		}

		await this.sync.initialize();

		const tStore = performance.now();

		await registerFeatures(plugin);

		// The local API binds a Node http server via Electron's require, which
		// does not exist on mobile.
		if (plugin.settings.enableLocalApi && capabilities.canRunLocalApi()) {
			void startLocalApi(plugin, plugin.settings.apiPort, this.isUnloaded).then(
				(server) => {
					if (server) plugin.localApi = server;
				},
			);
		}

		const tTotal = performance.now();
		console.debug(
			`[True Recall Startup] setup: ${(tSetup - t0).toFixed(1)}ms` +
				` | store: ${(tStore - tSetup).toFixed(1)}ms` +
				` | views+commands: ${(tTotal - tStore).toFixed(1)}ms` +
				` | total: ${(tTotal - t0).toFixed(1)}ms`,
		);
	}
	stopSharedVaultSync(): void {
		this.sync.stop();
	}
}
