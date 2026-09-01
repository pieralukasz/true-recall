import { signal } from "@preact/signals";

import { CloudSyncService } from "@true-recall/core/integration/cloud/cloud-sync.service";
import { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import { FsrsReplayService } from "@true-recall/core/services/fsrs/fsrs-replay.service";
import {
	extractFSRSSettings,
	extractFSRSSettingsFromPreset,
} from "@true-recall/core/types/settings.types";

import { G } from "@true-recall/obsidian/data";
import { CloudAuthService } from "@true-recall/obsidian/services/cloud/cloud-auth.service";
import { CloudSyncApiClient } from "@true-recall/obsidian/services/cloud/cloud-sync-api.client";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { setLastMutation } from "@true-recall/obsidian/services/signals";

import type TrueRecallPlugin from "../main";
import { CloudSyncCoordinator } from "./CloudSyncCoordinator";

const SYNC_INTERVAL_MS = 60_000;
const CHANGE_DEBOUNCE_MS = 2_500;

export type CloudAuthState =
	| "idle"
	| "preparing"
	| "waiting"
	| "exchanging"
	| "error";

export class CloudSyncManager {
	readonly accountEmail = signal<string | null>(null);
	readonly authState = signal<CloudAuthState>("idle");
	readonly coordinator: CloudSyncCoordinator;
	readonly auth: CloudAuthService;
	private readonly apiClient: CloudSyncApiClient;
	private changeTimer: number | null = null;

	constructor(private readonly plugin: TrueRecallPlugin) {
		this.auth = new CloudAuthService(plugin.app, () => ({
			id: plugin.deviceIdService?.getDeviceId() ?? "unknown-device",
			name: plugin.deviceIdService?.getDisplayName() ?? "True Recall device",
		}));
		this.apiClient = new CloudSyncApiClient(this.auth, () =>
			this.handleAuthExpired(),
		);
		this.accountEmail.value = this.auth.getSession()?.email ?? null;
		this.coordinator = new CloudSyncCoordinator(() => this.runSync());
	}

	initialize(): void {
		this.plugin.registerObsidianProtocolHandler(
			"true-recall-auth",
			(params) => {
				void this.handleAuthCallback(params.code, params.state);
			},
		);

		this.plugin.app.workspace.onLayoutReady(() => {
			if (this.isEnabled()) void this.coordinator.syncNow("startup");
		});

		this.plugin.registerInterval(
			window.setInterval(() => {
				if (this.isEnabled()) void this.coordinator.syncNow("interval");
			}, SYNC_INTERVAL_MS),
		);

		this.plugin.registerDomEvent(activeDocument, "visibilitychange", () => {
			if (activeDocument.visibilityState === "visible" && this.isEnabled()) {
				void this.coordinator.syncNow("foreground");
			}
		});

		const dispose = this.plugin.coreApp.events.onAny(
			[
				"card:added",
				"card:updated",
				"card:removed",
				"card:reviewed",
				"cards:bulk",
				"note:changed",
			],
			() => this.scheduleAfterChange(),
		);
		this.plugin.register(dispose);
	}

	async beginSignIn(): Promise<void> {
		if (
			this.authState.value === "preparing" ||
			this.authState.value === "exchanging"
		)
			return;
		this.authState.value = "preparing";
		try {
			const authUrl = await this.auth.startAuth();
			window.open(authUrl, "_blank");
			this.authState.value = "waiting";
			notify().info("Finish connecting Cloud Sync in your browser.");
		} catch (error) {
			this.authState.value = "error";
			notify().error(
				error instanceof Error
					? error.message
					: "Could not start Cloud Sync sign-in.",
			);
		}
	}

	async signOut(): Promise<void> {
		// Never discard the local session while the token is still live on the
		// server: it is the only handle that can ever revoke that device.
		const revoked = await this.apiClient.revoke();
		if (!revoked) {
			notify().error(
				"Could not sign out: the server did not revoke this device. Check your connection and try again.",
			);
			return;
		}
		this.auth.clearSession();
		this.accountEmail.value = null;
		this.authState.value = "idle";
		this.plugin.settings.syncMode = "off";
		this.plugin.settings.cloudSyncEmail = undefined;
		await this.plugin.saveSettings();
	}

	async setEnabled(enabled: boolean): Promise<void> {
		this.plugin.settings.syncMode = enabled ? "cloud" : "off";
		this.plugin.settings.enableDeviceSync = false;
		if (enabled) this.plugin.teardownSharedVaultSync();
		await this.plugin.saveSettings();
		if (enabled) void this.coordinator.syncNow("manual");
	}

	isEnabled(): boolean {
		return (
			this.plugin.settings.syncMode === "cloud" &&
			this.auth.getSession() !== null
		);
	}

	private async handleAuthCallback(
		code?: string,
		state?: string,
	): Promise<void> {
		if (!code || !state) {
			this.authState.value = "error";
			notify().error("Cloud Sync sign-in returned an invalid response.");
			return;
		}
		this.authState.value = "exchanging";
		try {
			const session = await this.auth.exchange(code, state);
			this.accountEmail.value = session.email;
			this.plugin.settings.cloudSyncEmail = session.email;
			this.plugin.settings.syncMode = "cloud";
			this.plugin.settings.enableDeviceSync = false;
			this.plugin.teardownSharedVaultSync();
			await this.plugin.saveSettings();
			this.authState.value = "idle";
			notify().success(`Cloud Sync connected as ${session.email}.`);
			void this.coordinator.syncNow("manual");
		} catch (error) {
			this.authState.value = "error";
			notify().error(
				error instanceof Error ? error.message : "Cloud Sync sign-in failed.",
			);
		}
	}

	/**
	 * The server rejected our device token. The session is already cleared;
	 * bring the settings and UI in line so the user sees a sign-in prompt
	 * instead of a connected account that silently never syncs.
	 */
	private handleAuthExpired(): void {
		this.accountEmail.value = null;
		this.authState.value = "idle";
		this.plugin.settings.syncMode = "off";
		this.plugin.settings.cloudSyncEmail = undefined;
		void this.plugin.saveSettings();
		notify().warning(
			"Cloud Sync was signed out because the session expired. Sign in again in Settings → Integrations.",
		);
	}

	private scheduleAfterChange(): void {
		if (!this.isEnabled()) return;
		if (this.changeTimer !== null) window.clearTimeout(this.changeTimer);
		this.changeTimer = window.setTimeout(() => {
			this.changeTimer = null;
			void this.coordinator.syncNow("change");
		}, CHANGE_DEBOUNCE_MS);
	}

	private async runSync() {
		const session = this.auth.getSession();
		const store = this.plugin.cardStore;
		if (!session || !store) throw new Error("Cloud Sync is not ready");
		await store.saveNow({ bestEffort: true });
		const replay = new FsrsReplayService(
			new FSRSService(extractFSRSSettings(this.plugin.settings)),
			(name) => {
				const preset = name
					? this.plugin.settings.fsrsPresets.find((item) => item.name === name)
					: undefined;
				return preset
					? extractFSRSSettingsFromPreset(preset)
					: extractFSRSSettings(this.plugin.settings);
			},
		);
		const result = await new CloudSyncService(store, this.apiClient, {
			accountId: session.userId,
			deviceId: this.plugin.deviceIdService?.getDeviceId() ?? "unknown-device",
			replayService: replay,
			getDayStartHour: () => this.plugin.settings.dayStartHour,
		}).sync();
		if (result.cardIdsChanged.length > 0) {
			setLastMutation({
				type: "bulk",
				action: "update",
				cardIds: result.cardIdsChanged,
			});
			this.plugin.dataLayer?.invalidateGroups([
				G.CARDS,
				G.BROWSER,
				G.DASHBOARD,
				G.PANEL,
				G.REVIEW,
				G.STATS,
			]);
		}
		return result;
	}
}
