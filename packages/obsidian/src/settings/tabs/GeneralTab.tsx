import { useCallback, useRef, useState } from "preact/hooks";

import {
	DEFAULT_SETTINGS,
	TRUERECALL_BMC_URL,
	TRUERECALL_DASHBOARD_URL,
	TRUERECALL_DISCORD_URL,
	TRUERECALL_GITHUB_URL,
	TRUERECALL_NEWSLETTER_URL,
	TRUERECALL_PRICING_URL,
	TRUERECALL_WEB_URL,
} from "@true-recall/core/constants";
import type {
	ReviewContentWidth,
	ReviewKeybindings,
	ReviewViewMode,
	TrueRecallSettings,
	TypeInMode,
} from "@true-recall/core/types";
import { withPluginUtm } from "@true-recall/core/utils";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	SliderInput,
	TextAreaInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { KeyboardHandler } from "@true-recall/obsidian/features/study/ui/review/handlers/KeyboardHandler";
import { t } from "@true-recall/obsidian/i18n";
import {
	ACCESS_TIER_LABEL,
	buildFeatureTogglePatch,
	isFeatureAvailable,
	isPluginEnabled,
	resolveAccessTier,
} from "@true-recall/obsidian/plugin/plugin-utils";
import { useIcon } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { useSettings } from "../hooks/useSettings";
import { ProFeatureNotice } from "./ProFeatureNotice";

export function GeneralTab() {
	const { settings, save, plugin } = useSettings();

	return (
		<div class="tr-settings-sections">
			<FormCard title={t("Language")}>
				<FormField
					name={t("Settings language")}
					description={t(
						"Follow Obsidian or choose a language. Restart Obsidian to refresh settings navigation and search labels.",
					)}
				>
					<SelectInput
						value={settings.uiLanguage ?? "auto"}
						onChange={(value) =>
							void save({ uiLanguage: value as "auto" | "en" | "zh-CN" })
						}
						options={[
							{ value: "auto", label: t("Follow Obsidian") },
							{ value: "en", label: "English" },
							{ value: "zh-CN", label: "简体中文" },
						]}
					/>
				</FormField>
			</FormCard>
			<NewsletterCard />

			<FormCard title={t("Appearance")}>
				<FormField
					name={t("Hide tab bar")}
					description={t(
						"Hide the tab container at the top of the main window. Bind the 'Toggle tab bar' command to a hotkey to toggle it quickly.",
					)}
				>
					<ToggleInput
						value={settings.hideTabBar}
						onChange={(v) => {
							// Apply the DOM change immediately (mirrors the command path);
							// save() mutates settings synchronously before persisting.
							void save({ hideTabBar: v });
							plugin.applyTabBarVisibility();
						}}
					/>
				</FormField>
			</FormCard>

			<FormCard title={t("Dashboard")}>
				<FormField
					name={t("Show dashboard header")}
					description={t(
						"Show today's review summary and recently studied notes at the top of the dashboard",
					)}
				>
					<ToggleInput
						value={settings.showDashboardHeader}
						onChange={(v) => void save({ showDashboardHeader: v })}
					/>
				</FormField>
			</FormCard>

			<FormCard title={t("Review interface")}>
				<FormField
					name={t("Review mode")}
					description={t("Where to open the review session")}
				>
					<SelectInput
						value={settings.reviewMode}
						onChange={(v) => void save({ reviewMode: v as ReviewViewMode })}
						options={[
							{
								value: "fullscreen",
								get label() {
									return t("Fullscreen (main area)");
								},
							},
							{
								value: "panel",
								get label() {
									return t("Side panel");
								},
							},
						]}
					/>
				</FormField>

				<FormField
					name={t("Show review header")}
					description={t(
						"Display the counters bar and the 'Open note' button in review session",
					)}
				>
					<ToggleInput
						value={settings.showReviewHeader}
						onChange={(v) => void save({ showReviewHeader: v })}
					/>
				</FormField>

				<FormField
					name={t("Show header stats")}
					description={t(
						"Display new/learning/due counters in review session header",
					)}
				>
					<ToggleInput
						value={settings.showReviewHeaderStats}
						onChange={(v) => void save({ showReviewHeaderStats: v })}
					/>
				</FormField>

				<FormField
					name={t("Show next review time")}
					description={t("Display predicted interval on answer buttons")}
				>
					<ToggleInput
						value={settings.showNextReviewTime}
						onChange={(v) => void save({ showNextReviewTime: v })}
					/>
				</FormField>

				<FormField
					name={t("Continuous custom reviews")}
					description={t(
						"Show 'Next session' button after completing a custom review session",
					)}
				>
					<ToggleInput
						value={settings.continuousCustomReviews}
						onChange={(v) => void save({ continuousCustomReviews: v })}
					/>
				</FormField>

				<FormField
					name={t("Card content width")}
					description={t("Maximum width of card text in review (desktop only)")}
				>
					<SelectInput
						value={settings.reviewContentWidth}
						onChange={(v) =>
							void save({ reviewContentWidth: v as ReviewContentWidth })
						}
						options={[
							{
								value: "narrow",
								get label() {
									return t("Narrow (40rem / ~640px)");
								},
							},
							{
								value: "default",
								get label() {
									return t("Default (48rem / ~768px)");
								},
							},
							{
								value: "wide",
								get label() {
									return t("Wide (64rem / ~1024px)");
								},
							},
							{
								value: "full",
								get label() {
									return t("Full width");
								},
							},
						]}
					/>
				</FormField>

				<FormField
					name={t("Typed answers")}
					description={
						settings.proKey ? (
							"Default mode for new review sessions. Press T to toggle it during review."
						) : (
							<ProFeatureNotice message="AI semantic grading for typed answers is included with True Recall Pro." />
						)
					}
				>
					<SelectInput
						value={settings.defaultTypeInMode}
						disabled={!isFeatureAvailable(settings, "type-in-mode", "pro")}
						onChange={(value) =>
							void save({ defaultTypeInMode: value as TypeInMode })
						}
						options={[
							{
								value: "off",
								get label() {
									return t("Off");
								},
							},
							{
								value: "ai",
								get label() {
									return t("AI grading");
								},
							},
						]}
					/>
				</FormField>

				<FormField
					name={t("Show card source note name")}
					description={t(
						"Display the name of the source note for each card during review",
					)}
				>
					<ToggleInput
						value={settings.cardReviewShowSourceNote}
						onChange={(v) => void save({ cardReviewShowSourceNote: v })}
					/>
				</FormField>

				<FormField
					name={t("Show frontmatter in note review")}
					description={t("Display YAML frontmatter when reviewing whole notes")}
				>
					<ToggleInput
						value={settings.noteReviewShowFrontmatter}
						onChange={(v) => void save({ noteReviewShowFrontmatter: v })}
					/>
				</FormField>

				<FormField
					name={t("Ignore daily limits for note study")}
					description={t(
						"When studying a specific note from the dashboard, show all its cards regardless of daily limits",
					)}
				>
					<ToggleInput
						value={settings.ignoreDailyLimitsForNoteStudy}
						onChange={(v) => void save({ ignoreDailyLimitsForNoteStudy: v })}
					/>
				</FormField>

				<ReviewKeybindingsSection
					keybindings={settings.reviewKeybindings}
					onSave={(kb) => void save({ reviewKeybindings: kb })}
				/>
			</FormCard>

			<FormCard
				title={t("Image occlusion")}
				description={t(
					"Create visual flashcards by masking regions of diagrams, maps, and images.",
				)}
			>
				<FormField
					name={t("Creation tools")}
					description={
						settings.proKey ? (
							"Show Image Occlusion in commands and quick-action toolbars. Existing cards remain readable when disabled."
						) : (
							<ProFeatureNotice message="Image Occlusion creation tools are included with True Recall Pro." />
						)
					}
				>
					<ToggleInput
						value={isPluginEnabled(settings, "image-occlusion")}
						disabled={!isFeatureAvailable(settings, "image-occlusion", "pro")}
						onChange={(value) =>
							void save(
								buildFeatureTogglePatch(settings, "image-occlusion", value),
							)
						}
					/>
				</FormField>

				<FormField
					name={t("AI detection prompt")}
					description={t(
						"Optional custom prompt for automatic region detection. Leave empty to use the built-in prompt.",
					)}
					layout="stacked"
				>
					<TextAreaInput
						value={settings.aiIODetectionPrompt ?? ""}
						disabled={!isPluginEnabled(settings, "image-occlusion")}
						onChange={(value) =>
							void save({
								aiIODetectionPrompt:
									value.trim().length > 0 ? value : undefined,
							})
						}
						rows={4}
						class="ep:w-full ep:font-mono ep:text-ui-smaller"
					/>
				</FormField>
			</FormCard>

			<FormCard title={t("Day boundary")}>
				<FormField
					name={t("Next day starts at")}
					description={t(
						"Hour when a new day begins (0-23). Default: 4 (4:00 am)",
					)}
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

			<FormCard title={t("About")}>
				<PlanField settings={settings} />
				<FormField
					name={t("What's New")}
					description={t(
						"Browse current and earlier release notes, including while offline",
					)}
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() =>
							void (async () => {
								const { getReleaseNotes } = await import(
									"@true-recall/obsidian/services/release-notes.service"
								);
								const releases = getReleaseNotes(plugin.manifest.version);
								if (releases.length === 0) {
									notify().error(
										"No release notes are available for this version.",
									);
									return;
								}
								const { WhatsNewModal } = await import(
									"@true-recall/obsidian/modals/shared/WhatsNewModal"
								);
								new WhatsNewModal(plugin, releases).open();
							})()
						}
					>
						{t("View release notes")}
					</Clickable>
				</FormField>

				<FormField
					name={t("Website")}
					description={t("Visit the True Recall website")}
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() =>
							window.open(
								withPluginUtm(TRUERECALL_WEB_URL, "settings-about"),
								"_blank",
							)
						}
					>
						truerecall.app
					</Clickable>
				</FormField>

				<FormField
					name={t("Discord")}
					description={t("Join the True Recall community")}
				>
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={() => window.open(TRUERECALL_DISCORD_URL, "_blank")}
					>
						{t("Join Discord")}
					</Clickable>
				</FormField>
			</FormCard>

			<SupportCard />
		</div>
	);
}

function NewsletterCard() {
	const mailRef = useIcon("mail");

	return (
		<FormCard
			title={t("Newsletter — Learn how to learn")}
			class="tr-setting-section--accent"
		>
			<FormField
				name={t("Personal newsletter about learning")}
				description={t(
					"Spaced repetition, memory, and how we should actually study — plus every True Recall release",
				)}
			>
				<Clickable
					class="ep-btn mod-cta tr-settings-action ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() =>
						window.open(
							withPluginUtm(TRUERECALL_NEWSLETTER_URL, "settings-newsletter"),
							"_blank",
						)
					}
				>
					<div ref={mailRef} class="ep:w-4 ep:h-4" />
					{t("Subscribe")}
				</Clickable>
			</FormField>
		</FormCard>
	);
}

const KEYBINDING_FIELDS: {
	key: keyof ReviewKeybindings;
	label: string;
	description: string;
}[] = [
	{
		key: "revealAndGood",
		get label() {
			return t("Reveal / Good");
		},
		get description() {
			return t("Reveal answer, then rate Good");
		},
	},
	{
		key: "again",
		get label() {
			return t("Again");
		},
		get description() {
			return t("Rate Again (fail)");
		},
	},
	{
		key: "hard",
		get label() {
			return t("Hard");
		},
		get description() {
			return t("Rate Hard");
		},
	},
	{
		key: "easy",
		get label() {
			return t("Easy");
		},
		get description() {
			return t("Rate Easy");
		},
	},
];

function PlanField({ settings }: { settings: TrueRecallSettings }) {
	const tier = resolveAccessTier(settings);
	const isPro = tier === "pro";
	return (
		<FormField
			name={t("Plan")}
			description={
				isPro
					? t("Managed AI, Image Occlusion and Typed Answers are unlocked.")
					: tier === "byok"
						? "You use your own AI provider. Pro adds managed AI, Image Occlusion and Typed Answers."
						: "Review and scheduling are free. Add an AI key or try Pro free for AI flashcards."
			}
		>
			<div class="ep:flex ep:items-center ep:gap-2">
				<span class="ep:text-sm ep:font-medium">{ACCESS_TIER_LABEL[tier]}</span>
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={() =>
						window.open(
							withPluginUtm(
								isPro ? TRUERECALL_DASHBOARD_URL : TRUERECALL_PRICING_URL,
								"settings-plan",
							),
							"_blank",
						)
					}
				>
					{isPro ? t("Manage subscription") : t("View plans")}
				</Clickable>
			</div>
		</FormField>
	);
}

function ReviewKeybindingsSection({
	keybindings,
	onSave,
}: {
	keybindings: ReviewKeybindings;
	onSave: (kb: ReviewKeybindings) => void;
}) {
	const [error, setError] = useState<string | null>(null);

	const handleKeyChange = useCallback(
		(field: keyof ReviewKeybindings, key: string) => {
			const next = { ...keybindings, [field]: key };
			const values = Object.values(next);
			const hasDuplicate = values.length !== new Set(values).size;
			if (hasDuplicate) {
				setError(
					`"${KeyboardHandler.formatKeyName(key)}" is already bound to another action`,
				);
				return;
			}
			setError(null);
			onSave(next);
		},
		[keybindings, onSave],
	);

	const isDefault =
		keybindings.revealAndGood ===
			DEFAULT_SETTINGS.reviewKeybindings.revealAndGood &&
		keybindings.again === DEFAULT_SETTINGS.reviewKeybindings.again &&
		keybindings.hard === DEFAULT_SETTINGS.reviewKeybindings.hard &&
		keybindings.easy === DEFAULT_SETTINGS.reviewKeybindings.easy;

	return (
		<>
			<div class="ep:border-t ep:border-obs-border ep:mt-2 ep:pt-3">
				<div class="ep:flex ep:items-center ep:justify-between ep:mb-2">
					<span class="ep:text-ui-small ep:font-medium ep:text-obs-muted">
						{t("Review keybindings")}
					</span>
					{!isDefault && (
						<Clickable
							class="ep:text-ui-smallest ep:text-obs-muted ep:hover:text-obs-normal ep:cursor-pointer"
							onClick={() => {
								setError(null);
								onSave(DEFAULT_SETTINGS.reviewKeybindings);
							}}
						>
							{t("Reset to defaults")}
						</Clickable>
					)}
				</div>
				<InfoBlock>
					{t(
						"Number keys 1-4 always work as rating shortcuts regardless of custom bindings.",
					)}
				</InfoBlock>
			</div>
			{KEYBINDING_FIELDS.map(({ key, label, description }) => (
				<FormField key={key} name={label} description={description}>
					<KeyCapture
						value={keybindings[key]}
						onChange={(v) => handleKeyChange(key, v)}
					/>
				</FormField>
			))}
			{error && (
				<div class="ep:text-ui-smallest ep:text-obs-error ep:mt-1">{error}</div>
			)}
		</>
	);
}

function KeyCapture({
	value,
	onChange,
}: {
	value: string;
	onChange: (key: string) => void;
}) {
	const [isCapturing, setIsCapturing] = useState(false);
	const btnRef = useRef<HTMLButtonElement>(null);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Escape") {
				setIsCapturing(false);
				return;
			}
			if (e.key === "Tab") return;
			onChange(e.key);
			setIsCapturing(false);
		},
		[onChange],
	);

	const handleClick = useCallback(() => {
		setIsCapturing(true);
	}, []);

	const handleBlur = useCallback(() => {
		setIsCapturing(false);
	}, []);

	return (
		<button
			ref={btnRef}
			type="button"
			class={`ep:px-3 ep:py-1.5 ep:rounded-md ep:border ep:text-ui-small ep:font-mono ep:min-w-[80px] ep:text-center ep:cursor-pointer ep:transition-colors ${
				isCapturing
					? "ep:border-obs-interactive ep:bg-obs-interactive/10 ep:text-obs-interactive"
					: "ep:border-obs-border ep:bg-obs-primary ep:text-obs-normal ep:hover:border-obs-interactive"
			}`}
			onClick={handleClick}
			onBlur={handleBlur}
			onKeyDown={handleKeyDown}
		>
			{isCapturing ? t("Press a key...") : KeyboardHandler.formatKeyName(value)}
		</button>
	);
}

function SupportCard() {
	const heartRef = useIcon("heart");
	const githubRef = useIcon("github");

	return (
		<FormCard title={t("Support")} class="tr-setting-section--support">
			<InfoBlock>
				{t(
					"If True Recall helps your learning, consider supporting its development.",
				)}
			</InfoBlock>
			<div class="tr-settings-actions">
				<Clickable
					class="ep-btn mod-cta tr-settings-action ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_BMC_URL, "_blank")}
				>
					<div ref={heartRef} class="ep:w-4 ep:h-4" />
					{t("Buy Me a Coffee")}
				</Clickable>
				<Clickable
					class="ep-btn ep-btn-outline tr-settings-action ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_GITHUB_URL, "_blank")}
				>
					<div ref={githubRef} class="ep:w-4 ep:h-4" />
					{t("GitHub")}
				</Clickable>
			</div>
		</FormCard>
	);
}
