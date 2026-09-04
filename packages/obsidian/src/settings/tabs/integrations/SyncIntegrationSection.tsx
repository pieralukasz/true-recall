import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	ToggleInput,
} from "@true-recall/obsidian/components";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { cloudAuthButtonLabel } from "@true-recall/obsidian/plugin/CloudSyncManager";

interface SyncIntegrationSectionProps {
	settings: TrueRecallSettings;
	save: (partial: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: TrueRecallPlugin;
}

function describeSyncStatus(
	isSyncing: boolean,
	lastError: string | null,
	lastSyncedAt: number | null,
): string {
	if (isSyncing) return "Syncing…";
	if (lastError) return `Last sync failed: ${lastError}`;
	if (lastSyncedAt)
		return `Last synced ${new Date(lastSyncedAt).toLocaleString()}`;
	return "Not synced yet in this session";
}

export function SyncIntegrationSection({
	settings,
	save,
	plugin,
}: SyncIntegrationSectionProps) {
	const manager = plugin.cloudSyncManager;
	const accountEmail = manager?.accountEmail.value;
	const { label: authLabel, busy: authInProgress } = cloudAuthButtonLabel(
		manager?.authState.value ?? "idle",
		"Sign in",
	);
	const coordinator = manager?.coordinator;
	const isSyncing = coordinator?.isSyncing.value ?? false;
	const lastError = coordinator?.lastError.value ?? null;
	const lastSyncedAt = coordinator?.lastSyncedAt.value ?? null;
	const cloudActive = settings.syncMode === "cloud";

	return (
		<FormCard title="Sync" class="tr-setting-section--sync">
			<InfoBlock>
				Cloud Sync is free and uses your True Recall account. Every device signs
				in on its own: the account travels with you, the sign-in does not travel
				with the vault. Shared vault keeps the existing iCloud-style file
				transport. Each device remains fully usable offline. On mobile, sign-in
				opens your browser and returns to this vault through an Obsidian link.
			</InfoBlock>

			<FormField
				name="Cloud Sync"
				description={
					accountEmail ??
					(cloudActive
						? "Turned on for this vault, but this device is not signed in"
						: "Account required")
				}
				class={accountEmail ? "tr-setting-item--active" : undefined}
			>
				{accountEmail ? (
					<div class="tr-sync-actions">
						<ToggleInput
							value={cloudActive}
							onChange={(enabled) => void manager?.setEnabled(enabled)}
							ariaLabel="Enable Cloud Sync"
						/>
						<Clickable
							class="ep-btn ep-btn-outline tr-sync-signout"
							onClick={() => void manager?.signOut()}
						>
							Sign out
						</Clickable>
					</div>
				) : (
					<Clickable
						class="ep-btn mod-cta"
						disabled={authInProgress}
						onClick={() => void manager?.beginSignIn()}
					>
						{authLabel}
					</Clickable>
				)}
			</FormField>

			{accountEmail && cloudActive && coordinator && (
				<FormField
					name="Sync status"
					description={describeSyncStatus(isSyncing, lastError, lastSyncedAt)}
					class={lastError && !isSyncing ? "tr-setting-item--error" : undefined}
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						disabled={isSyncing}
						onClick={() => void coordinator.syncNow("manual")}
					>
						{isSyncing ? "Syncing…" : "Sync now"}
					</Clickable>
				</FormField>
			)}

			<FormField
				name="Shared vault"
				description="Merge device databases synchronized by iCloud, Obsidian Sync, or another file service. Reload Obsidian after changing this mode."
			>
				<ToggleInput
					value={settings.syncMode === "shared-vault"}
					onChange={(enabled) =>
						void save({
							syncMode: enabled ? "shared-vault" : "off",
							enableDeviceSync: enabled,
						})
					}
					ariaLabel="Enable shared vault sync"
				/>
			</FormField>
		</FormCard>
	);
}
