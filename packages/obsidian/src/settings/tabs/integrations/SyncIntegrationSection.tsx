import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	ToggleInput,
} from "@true-recall/obsidian/components";
import type TrueRecallPlugin from "@true-recall/obsidian/main";

interface SyncIntegrationSectionProps {
	settings: TrueRecallSettings;
	save: (partial: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: TrueRecallPlugin;
}

export function SyncIntegrationSection({
	settings,
	save,
	plugin,
}: SyncIntegrationSectionProps) {
	const accountEmail = plugin.cloudSyncManager?.accountEmail.value;
	const authState = plugin.cloudSyncManager?.authState.value ?? "idle";
	const authInProgress =
		authState === "preparing" || authState === "exchanging";
	const authLabel =
		authState === "preparing"
			? "Opening browser…"
			: authState === "waiting"
				? "Open browser again"
				: authState === "exchanging"
					? "Connecting…"
					: authState === "error"
						? "Try again"
						: "Sign in";

	return (
		<FormCard title="Sync" class="tr-setting-section--sync">
			<InfoBlock>
				Cloud Sync is free and uses your True Recall account. Shared vault keeps
				the existing iCloud-style file transport. Each device remains fully
				usable offline. On mobile, sign-in opens your browser and returns to
				this vault through an Obsidian link.
			</InfoBlock>

			<FormField
				name="Cloud Sync"
				description={accountEmail ?? "Account required"}
				class={accountEmail ? "tr-setting-item--active" : undefined}
			>
				{accountEmail ? (
					<div class="tr-sync-actions">
						<ToggleInput
							value={settings.syncMode === "cloud"}
							onChange={(enabled) =>
								void plugin.cloudSyncManager?.setEnabled(enabled)
							}
							ariaLabel="Enable Cloud Sync"
						/>
						<Clickable
							class="ep-btn ep-btn-outline tr-sync-signout"
							onClick={() => void plugin.cloudSyncManager?.signOut()}
						>
							Sign out
						</Clickable>
					</div>
				) : (
					<Clickable
						class="ep-btn mod-cta"
						disabled={authInProgress}
						onClick={() => void plugin.cloudSyncManager?.beginSignIn()}
					>
						{authLabel}
					</Clickable>
				)}
			</FormField>

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
