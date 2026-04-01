import {
	TRUERECALL_BMC_URL,
	TRUERECALL_DISCORD_URL,
	TRUERECALL_GITHUB_URL,
	TRUERECALL_WEB_URL,
} from "@true-recall/core/constants";
import type { ReviewViewMode, TypeInMode } from "@true-recall/core/types";
import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { useSettings } from "../hooks/useSettings";
import { ToolbarConfigSection } from "../ToolbarConfigSection";

export function GeneralTab() {
	const { settings, save, plugin } = useSettings();

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			{!settings.proKey && (
				<FormCard title="True Recall Pro">
					<InfoBlock>
						True Recall Pro — zero-setup AI with optimized prompts, included in
						your subscription. Set up your key in the <strong>AI</strong>{" "}
						settings tab.
					</InfoBlock>
				</FormCard>
			)}

			<FormCard title="Review interface">
				<FormField
					name="Review mode"
					description="Where to open the review session"
				>
					<SelectInput
						value={settings.reviewMode}
						onChange={(v) => void save({ reviewMode: v as ReviewViewMode })}
						options={[
							{ value: "fullscreen", label: "Fullscreen (main area)" },
							{ value: "panel", label: "Side panel" },
						]}
					/>
				</FormField>

				<FormField
					name="Show review header"
					description="Display header with close button, stats and progress in review session"
				>
					<ToggleInput
						value={settings.showReviewHeader}
						onChange={(v) => void save({ showReviewHeader: v })}
					/>
				</FormField>

				<FormField
					name="Show header stats"
					description="Display new/learning/due counters in review session header"
				>
					<ToggleInput
						value={settings.showReviewHeaderStats}
						onChange={(v) => void save({ showReviewHeaderStats: v })}
					/>
				</FormField>

				<FormField
					name="Show next review time"
					description="Display predicted interval on answer buttons"
				>
					<ToggleInput
						value={settings.showNextReviewTime}
						onChange={(v) => void save({ showNextReviewTime: v })}
					/>
				</FormField>

				<FormField
					name="Continuous custom reviews"
					description="Show 'Next session' button after completing a custom review session"
				>
					<ToggleInput
						value={settings.continuousCustomReviews}
						onChange={(v) => void save({ continuousCustomReviews: v })}
					/>
				</FormField>

				<FormField
					name="Ignore daily limits for note study"
					description="When studying a specific note from the dashboard, show all its cards regardless of daily limits"
				>
					<ToggleInput
						value={settings.ignoreDailyLimitsForNoteStudy}
						onChange={(v) => void save({ ignoreDailyLimitsForNoteStudy: v })}
					/>
				</FormField>

				<FormField
					name="Default type-in mode"
					description="Type-in mode used when a new review session starts (T still cycles modes in-session)"
				>
					<SelectInput
						value={settings.defaultTypeInMode}
						onChange={(v) => void save({ defaultTypeInMode: v as TypeInMode })}
						options={[
							{ value: "off", label: "Off" },
							{ value: "diff", label: "Diff" },
							{ value: "ai", label: "AI" },
						]}
					/>
				</FormField>
			</FormCard>

			<FormCard title="Editor integration">
				<FormField
					name="Show link status indicators"
					description="Display inline flashcard counts (new/learning/review) next to [[links]] that point to notes with flashcards"
				>
					<ToggleInput
						value={settings.showLinkStatusIndicators}
						onChange={(v) => void save({ showLinkStatusIndicators: v })}
					/>
				</FormField>

				<FormField
					name="Show donuts in flashcard panel"
					description="Display donut indicators next to links inside flashcard panel cards"
				>
					<ToggleInput
						value={settings.showDonutsInPanel}
						onChange={(v) => void save({ showDonutsInPanel: v })}
					/>
				</FormField>

				<FormField
					name="Show donuts in review"
					description="Display donut indicators next to links during review sessions"
				>
					<ToggleInput
						value={settings.showDonutsInReview}
						onChange={(v) => void save({ showDonutsInReview: v })}
					/>
				</FormField>

				<FormField
					name="Show status bar widget"
					description="Display global due/new/learning card counts in the bottom status bar"
				>
					<ToggleInput
						value={settings.showStatusBarWidget}
						onChange={(v) => void save({ showStatusBarWidget: v })}
					/>
				</FormField>

				<FormField
					name="Selection toolbar"
					description="Show a floating toolbar above selected text for AI-powered flashcard creation."
				>
					<ToggleInput
						value={settings.selectionToolbarEnabled}
						onChange={(v) => void save({ selectionToolbarEnabled: v })}
					/>
				</FormField>
			</FormCard>

			{settings.selectionToolbarEnabled && (
				<>
					<ToolbarConfigSection
						title="Editor toolbar"
						description="Buttons shown when selecting text in the markdown editor"
						buttons={settings.editorToolbarButtons}
						onChange={(b) => void save({ editorToolbarButtons: b })}
						context="editor"
					/>
					<ToolbarConfigSection
						title="Global toolbar"
						description="Buttons shown when selecting text outside the editor (sidebars, terminal, reading view)"
						buttons={settings.globalToolbarButtons}
						onChange={(b) => void save({ globalToolbarButtons: b })}
						context="global"
					/>
				</>
			)}

			<FormCard title="Day boundary">
				<FormField
					name="Next day starts at"
					description="Hour when a new day begins (0-23). Default: 4 (4:00 am)"
				>
					<SliderInput
						value={settings.dayStartHour}
						onChange={(v) => void save({ dayStartHour: v })}
						min={0}
						max={23}
						step={1}
						formatTooltip={(v) => `${v}:00`}
					/>
				</FormField>
			</FormCard>

			<FormCard title="Local API (MCP)">
				<InfoBlock>
					Expose a local HTTP API for Claude Code and other MCP-compatible
					tools. Binds to 127.0.0.1 only — never exposed to the network.
				</InfoBlock>

				<FormField
					name="Enable local API"
					description="Start an HTTP server for MCP/CLI integration when the plugin loads"
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

			<FormCard title="About">
				<FormField
					name="What's New"
					description={`See release notes for version ${plugin.manifest.version}`}
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() =>
							void (async () => {
								const { fetchLatestRelease } = await import(
									"@true-recall/obsidian/services/release-notes.service"
								);
								const release = await fetchLatestRelease();
								if (!release) {
									notify().error(
										"Could not fetch release notes. Check your internet connection.",
									);
									return;
								}
								const { WhatsNewModal } = await import(
									"@true-recall/obsidian/modals/shared/WhatsNewModal"
								);
								new WhatsNewModal(plugin, release).open();
							})()
						}
					>
						View release notes
					</Clickable>
				</FormField>

				<FormField name="Website" description="Visit the True Recall website">
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() => window.open(TRUERECALL_WEB_URL, "_blank")}
					>
						truerecall.app
					</Clickable>
				</FormField>

				<FormField name="Discord" description="Join the True Recall community">
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() => window.open(TRUERECALL_DISCORD_URL, "_blank")}
					>
						Join Discord
					</Clickable>
				</FormField>
			</FormCard>

			<SupportCard />
		</div>
	);
}

function SupportCard() {
	const heartRef = useIcon("heart");
	const githubRef = useIcon("github");

	return (
		<FormCard title="Support">
			<InfoBlock>
				If True Recall helps your learning, consider supporting its development.
			</InfoBlock>
			<div class="ep:flex ep:gap-2 ep:mt-1">
				<Clickable
					class="ep-btn ep-btn-outline ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_BMC_URL, "_blank")}
				>
					<div ref={heartRef} class="ep:w-4 ep:h-4" />
					Buy Me a Coffee
				</Clickable>
				<Clickable
					class="ep-btn ep-btn-outline ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_GITHUB_URL, "_blank")}
				>
					<div ref={githubRef} class="ep:w-4 ep:h-4" />
					GitHub
				</Clickable>
			</div>
		</FormCard>
	);
}
