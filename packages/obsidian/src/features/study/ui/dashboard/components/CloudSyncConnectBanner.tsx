import { TRUERECALL_WEB_URL } from "@true-recall/core/constants";

import { Clickable } from "@true-recall/obsidian/components";
import { cloudAuthButtonLabel } from "@true-recall/obsidian/plugin/CloudSyncManager";
import { usePlugin } from "@true-recall/obsidian/preact";

const CLOUD_SYNC_DOCS_URL = `${TRUERECALL_WEB_URL}/data/cloud-sync/`;

/**
 * Shown when the vault's settings say Cloud Sync but this device holds no
 * session. Settings travel with the vault (iCloud, Obsidian Sync, git); the
 * device token does not. A phone therefore inherits `syncMode: "cloud"` from
 * the desktop and, without this bar, silently keeps every review to itself.
 */
export function CloudSyncConnectBanner() {
	const plugin = usePlugin();
	const manager = plugin.cloudSyncManager;
	if (!manager || plugin.settings.syncMode !== "cloud") return null;
	if (manager.accountEmail.value) return null;

	const { label, busy } = cloudAuthButtonLabel(
		manager.authState.value,
		"Sign in on this device",
	);

	return (
		<div
			class="ep:flex ep:flex-wrap ep:items-center ep:gap-x-3 ep:gap-y-2 ep:px-3 ep:py-2 ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-modifier-hover/40 ep:text-sm"
			role="status"
		>
			<span class="ep:flex-1 ep:min-w-[200px] ep:text-obs-normal">
				Cloud Sync is turned on for this vault, but this device is not signed in
				yet. Reviews and cards made here stay on this device until you connect
				it to your account.
			</span>
			<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2">
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={() => window.open(CLOUD_SYNC_DOCS_URL, "_blank")}
				>
					How it works
				</Clickable>
				<Clickable
					class="mod-cta ep-btn"
					disabled={busy}
					onClick={() => void manager.beginSignIn()}
				>
					{label}
				</Clickable>
			</div>
		</div>
	);
}
