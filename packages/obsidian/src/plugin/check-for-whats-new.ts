import type TrueRecallPlugin from "../main";

export async function checkForWhatsNew(
	plugin: TrueRecallPlugin,
): Promise<void> {
	const currentVersion = plugin.manifest.version;
	const lastSeenVersion = plugin.settings.lastSeenVersion;
	if (lastSeenVersion === currentVersion) return;
	if (lastSeenVersion === undefined) {
		await plugin.saveSettings({ lastSeenVersion: currentVersion });
		return;
	}

	const { getReleaseNotes } = await import(
		"@true-recall/obsidian/services/release-notes.service"
	);
	const unseen = getReleaseNotes(currentVersion, lastSeenVersion);
	// Do not consume the update marker if notes for this build are missing.
	if (!unseen.some((release) => release.version === currentVersion)) return;

	const { WhatsNewModal } = await import(
		"@true-recall/obsidian/modals/shared/WhatsNewModal"
	);
	new WhatsNewModal(
		plugin,
		getReleaseNotes(currentVersion),
		unseen.map((release) => release.version),
	).open();
	await plugin.saveSettings({ lastSeenVersion: currentVersion });
}
