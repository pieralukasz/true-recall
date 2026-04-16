import { TRUERECALL_WEB_URL } from "@true-recall/core/constants";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";

import { useSettings } from "../hooks/useSettings";

export function IntegrationsTab() {
	const { settings, save, plugin } = useSettings();

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<FormCard title="Local API">
				<InfoBlock>
					Expose a local HTTP API for the True Recall CLI. Binds to 127.0.0.1
					only — never exposed to the network.
				</InfoBlock>

				<FormField
					name="Enable local API"
					description="Start an HTTP server for CLI integration when the plugin loads"
				>
					<ToggleInput
						value={settings.enableLocalApi}
						onChange={(v) => {
							void save({ enableLocalApi: v });
							if (v) {
								void (async () => {
									if (!plugin.localApi) {
										const { LocalApiServer } = await import(
											"@true-recall/obsidian/plugin/api/LocalApiServer"
										);
										plugin.localApi = new LocalApiServer(
											plugin,
											settings.apiPort,
										);
									}
									plugin.localApi?.start();
								})();
							} else {
								plugin.localApi?.stop();
							}
						}}
					/>
				</FormField>

				<FormField
					name="Port"
					description="Local API port (default: 27182). Restart Obsidian after changing."
				>
					<TextInput
						value={String(settings.apiPort)}
						placeholder="27182"
						onChange={(v) => {
							const port = Number.parseInt(v, 10);
							if (!Number.isNaN(port) && port >= 1024 && port <= 65535) {
								void save({ apiPort: port });
							}
						}}
					/>
				</FormField>

				{plugin.localApi?.isRunning() && (
					<InfoBlock>
						API running on{" "}
						<code>http://127.0.0.1:{plugin.localApi.getPort()}</code>
					</InfoBlock>
				)}
			</FormCard>

			<FormCard title="Claude Code">
				<FormField
					name="Claude Code Skill"
					description="Install the True Recall skill for Claude Code to control flashcards from the terminal"
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() =>
							window.open(
								`${TRUERECALL_WEB_URL}/reference/claude-code-skill/`,
								"_blank",
							)
						}
					>
						Get skill
					</Clickable>
				</FormField>
			</FormCard>

			<FormCard title="Device Sync">
				<InfoBlock>
					Sync flashcards and review history across devices via iCloud. Each
					device keeps its own database — changes are merged on startup using
					last-write-wins.
				</InfoBlock>

				<FormField
					name="Enable device sync"
					description="Merge changes from other devices when the plugin loads"
				>
					<ToggleInput
						value={settings.enableDeviceSync}
						onChange={(v) => {
							void save({ enableDeviceSync: v });
						}}
					/>
				</FormField>
			</FormCard>
		</div>
	);
}
