import { TrueRecallApp } from "@true-recall/core/app";
import { MOBILE_SAVE_DEBOUNCE_MS } from "@true-recall/core/persistence/sqlite/sqlite.types";

import { createObsidianAdapters } from "@true-recall/obsidian/context";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { isMobile } from "@true-recall/obsidian/utils/platform";
export async function initializeCoreStorage(
	plugin: TrueRecallPlugin,
): Promise<void> {
	plugin.adapters = createObsidianAdapters(plugin.app);
	const { ObsidianSettingsPersistence } = await import(
		"@true-recall/obsidian/adapters/ObsidianSettingsPersistence"
	);
	const { ObsidianLinkResolver } = await import(
		"@true-recall/obsidian/adapters/ObsidianLinkResolver"
	);
	const { ObsidianVaultEventBridge } = await import(
		"@true-recall/obsidian/adapters/ObsidianVaultEventBridge"
	);

	plugin.coreApp = new TrueRecallApp({
		...plugin.adapters,
		settingsPersistence: new ObsidianSettingsPersistence(plugin),
		linkResolver: new ObsidianLinkResolver(plugin.app),
		vaultEvents: new ObsidianVaultEventBridge(plugin.app, plugin),
		// Mobile OSes can kill the app without unload events; keep the
		// window between a review and its disk flush minimal there.
		storeOptions: isMobile()
			? { saveDebounceMs: MOBILE_SAVE_DEBOUNCE_MS }
			: undefined,
	});
	await plugin.coreApp.initialize();
}
