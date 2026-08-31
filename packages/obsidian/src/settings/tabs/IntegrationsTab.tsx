import { TRUERECALL_WEB_URL } from "@true-recall/core/constants";
import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { capabilities } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import { useSettings } from "../hooks/useSettings";
import { InkIntegrationSection } from "./integrations/InkIntegrationSection";

interface LocalApiCardProps {
	settings: TrueRecallSettings;
	save: (partial: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: TrueRecallPlugin;
}

function LocalApiCard({ settings, save, plugin }: LocalApiCardProps) {
	return (
		<FormCard title="Local API">
			<InfoBlock>
				Expose a local HTTP API for the True Recall CLI. Binds to 127.0.0.1
				only, never exposed to the network.
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
	);
}

export function IntegrationsTab() {
	const { settings, save, plugin } = useSettings();
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
		<div class="ep:flex ep:flex-col ep:gap-3">
			<InkIntegrationSection />

			{capabilities.canRunLocalApi() && (
				<LocalApiCard settings={settings} save={save} plugin={plugin} />
			)}

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

			<FormCard title="Sync">
				<InfoBlock>
					Cloud Sync is free and uses your True Recall account. Shared vault
					keeps the existing iCloud-style file transport. Each device remains
					fully usable offline. On mobile, sign-in opens your browser and
					returns to this vault through an Obsidian link.
				</InfoBlock>

				<FormField
					name="Cloud Sync"
					description={
						plugin.cloudSyncManager?.accountEmail.value ?? "Account required"
					}
				>
					{plugin.cloudSyncManager?.accountEmail.value ? (
						<div class="ep:flex ep:gap-2">
							<ToggleInput
								value={settings.syncMode === "cloud"}
								onChange={(enabled) =>
									void plugin.cloudSyncManager?.setEnabled(enabled)
								}
							/>
							<Clickable
								class="ep-btn ep-btn-outline"
								onClick={() => void plugin.cloudSyncManager?.signOut()}
							>
								Sign out
							</Clickable>
						</div>
					) : (
						<Clickable
							class="ep-btn ep-btn-outline"
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
					/>
				</FormField>
			</FormCard>
		</div>
	);
}
