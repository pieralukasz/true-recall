import { useSettings } from "@features/settings/hooks/useSettings";
import {
	TRUERECALL_BMC_URL,
	TRUERECALL_DISCORD_URL,
	TRUERECALL_GITHUB_URL,
	TRUERECALL_WEB_URL,
} from "@shared/constants";
import { notify } from "@shared/services/notification.service";
import type { ReviewViewMode, TypeInMode } from "@shared/types";
import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	SliderInput,
	ToggleInput,
} from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact";
import { AccountSection } from "./AccountSection";

export function GeneralTab() {
	const { settings, save, plugin } = useSettings();

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
			<AccountSection />

			<FormCard title="Review interface">
				<FormField
					name="Review mode"
					description="Where to open the review session"
				>
					<SelectInput
						value={settings.reviewMode}
						onChange={(v) => save({ reviewMode: v as ReviewViewMode })}
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
						onChange={(v) => save({ showReviewHeader: v })}
					/>
				</FormField>

				<FormField
					name="Show header stats"
					description="Display new/learning/due counters in review session header"
				>
					<ToggleInput
						value={settings.showReviewHeaderStats}
						onChange={(v) => save({ showReviewHeaderStats: v })}
					/>
				</FormField>

				<FormField
					name="Show next review time"
					description="Display predicted interval on answer buttons"
				>
					<ToggleInput
						value={settings.showNextReviewTime}
						onChange={(v) => save({ showNextReviewTime: v })}
					/>
				</FormField>

				<FormField
					name="Continuous custom reviews"
					description="Show 'Next session' button after completing a custom review session"
				>
					<ToggleInput
						value={settings.continuousCustomReviews}
						onChange={(v) => save({ continuousCustomReviews: v })}
					/>
				</FormField>

				<FormField
					name="Ignore daily limits for note study"
					description="When studying a specific note from the dashboard, show all its cards regardless of daily limits"
				>
					<ToggleInput
						value={settings.ignoreDailyLimitsForNoteStudy}
						onChange={(v) => save({ ignoreDailyLimitsForNoteStudy: v })}
					/>
				</FormField>

				<FormField
					name="Default type-in mode"
					description="Type-in mode used when a new review session starts (T still cycles modes in-session)"
				>
					<SelectInput
						value={settings.defaultTypeInMode}
						onChange={(v) => save({ defaultTypeInMode: v as TypeInMode })}
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
						onChange={(v) => save({ showLinkStatusIndicators: v })}
					/>
				</FormField>

				<FormField
					name="Show status bar widget"
					description="Display global due/new/learning card counts in the bottom status bar"
				>
					<ToggleInput
						value={settings.showStatusBarWidget}
						onChange={(v) => save({ showStatusBarWidget: v })}
					/>
				</FormField>

				<FormField
					name="Show quick review in panel"
					description="Show a collapsible quick-review section at the top of the flashcard panel"
				>
					<ToggleInput
						value={settings.showQuickReviewInPanel}
						onChange={(v) => save({ showQuickReviewInPanel: v })}
					/>
				</FormField>
			</FormCard>

			<FormCard title="Day boundary">
				<FormField
					name="Next day starts at"
					description="Hour when a new day begins (0-23). Default: 4 (4:00 am)"
				>
					<SliderInput
						value={settings.dayStartHour}
						onChange={(v) => save({ dayStartHour: v })}
						min={0}
						max={23}
						step={1}
						formatTooltip={(v) => `${v}:00`}
					/>
				</FormField>
			</FormCard>

			<FormCard title="About">
				<FormField
					name="What's New"
					description={`See release notes for version ${plugin.manifest.version}`}
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={async () => {
							const { fetchLatestRelease } = await import(
								"@shared/services/release-notes.service"
							);
							const release = await fetchLatestRelease();
							if (!release) {
								notify().error(
									"Could not fetch release notes. Check your internet connection.",
								);
								return;
							}
							const { WhatsNewModal } = await import(
								"@shared/ui/modals/WhatsNewModal"
							);
							new WhatsNewModal(plugin, release).open();
						}}
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
