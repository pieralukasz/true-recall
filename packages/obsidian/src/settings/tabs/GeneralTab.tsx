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
			<NewsletterCard />

			<FormCard title="Appearance">
				<FormField
					name="Hide tab bar"
					description="Hide the tab container at the top of the main window. Bind the 'Toggle tab bar' command to a hotkey to toggle it quickly."
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

			<FormCard title="Dashboard">
				<FormField
					name="Show dashboard header"
					description="Show today's review summary and recently studied notes at the top of the dashboard"
				>
					<ToggleInput
						value={settings.showDashboardHeader}
						onChange={(v) => void save({ showDashboardHeader: v })}
					/>
				</FormField>
			</FormCard>

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
					name="Card content width"
					description="Maximum width of card text in review (desktop only)"
				>
					<SelectInput
						value={settings.reviewContentWidth}
						onChange={(v) =>
							void save({ reviewContentWidth: v as ReviewContentWidth })
						}
						options={[
							{ value: "narrow", label: "Narrow (40rem / ~640px)" },
							{ value: "default", label: "Default (48rem / ~768px)" },
							{ value: "wide", label: "Wide (64rem / ~1024px)" },
							{ value: "full", label: "Full width" },
						]}
					/>
				</FormField>
        
        <FormField
					name="Typed answers"
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
							{ value: "off", label: "Off" },
							{ value: "ai", label: "AI grading" },
						]}
					/>
				</FormField>

				<FormField
					name="Show card source note name"
					description="Display the name of the source note for each card during review"
				>
					<ToggleInput
						value={settings.cardReviewShowSourceNote}
						onChange={(v) => void save({ cardReviewShowSourceNote: v })}
					/>
				</FormField>

				<FormField
					name="Show frontmatter in note review"
					description="Display YAML frontmatter when reviewing whole notes"
				>
					<ToggleInput
						value={settings.noteReviewShowFrontmatter}
						onChange={(v) => void save({ noteReviewShowFrontmatter: v })}
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

				<ReviewKeybindingsSection
					keybindings={settings.reviewKeybindings}
					onSave={(kb) => void save({ reviewKeybindings: kb })}
				/>
			</FormCard>

			<FormCard
				title="Image occlusion"
				description="Create visual flashcards by masking regions of diagrams, maps, and images."
			>
				<FormField
					name="Creation tools"
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
					name="AI detection prompt"
					description="Optional custom prompt for automatic region detection. Leave empty to use the built-in prompt."
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

			<FormCard title="About">
				<PlanField settings={settings} />
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

function NewsletterCard() {
	const mailRef = useIcon("mail");

	return (
		<FormCard
			title="Newsletter — Learn how to learn"
			class="tr-setting-section--accent"
		>
			<FormField
				name="Personal newsletter about learning"
				description="Spaced repetition, memory, and how we should actually study — plus every True Recall release"
			>
				<Clickable
					class="ep-btn mod-cta tr-settings-action ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_NEWSLETTER_URL, "_blank")}
				>
					<div ref={mailRef} class="ep:w-4 ep:h-4" />
					Subscribe
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
		label: "Reveal / Good",
		description: "Reveal answer, then rate Good",
	},
	{ key: "again", label: "Again", description: "Rate Again (fail)" },
	{ key: "hard", label: "Hard", description: "Rate Hard" },
	{ key: "easy", label: "Easy", description: "Rate Easy" },
];

function PlanField({ settings }: { settings: TrueRecallSettings }) {
	const tier = resolveAccessTier(settings);
	const isPro = tier === "pro";
	return (
		<FormField
			name="Plan"
			description={
				isPro
					? "Managed AI, Image Occlusion and Typed Answers are unlocked."
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
							isPro ? TRUERECALL_DASHBOARD_URL : TRUERECALL_PRICING_URL,
							"_blank",
						)
					}
				>
					{isPro ? "Manage subscription" : "View plans"}
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
						Review keybindings
					</span>
					{!isDefault && (
						<Clickable
							class="ep:text-ui-smallest ep:text-obs-muted ep:hover:text-obs-normal ep:cursor-pointer"
							onClick={() => {
								setError(null);
								onSave(DEFAULT_SETTINGS.reviewKeybindings);
							}}
						>
							Reset to defaults
						</Clickable>
					)}
				</div>
				<InfoBlock>
					Number keys 1-4 always work as rating shortcuts regardless of custom
					bindings.
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
			{isCapturing ? "Press a key..." : KeyboardHandler.formatKeyName(value)}
		</button>
	);
}

function SupportCard() {
	const heartRef = useIcon("heart");
	const githubRef = useIcon("github");

	return (
		<FormCard title="Support" class="tr-setting-section--support">
			<InfoBlock>
				If True Recall helps your learning, consider supporting its development.
			</InfoBlock>
			<div class="tr-settings-actions">
				<Clickable
					class="ep-btn mod-cta tr-settings-action ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_BMC_URL, "_blank")}
				>
					<div ref={heartRef} class="ep:w-4 ep:h-4" />
					Buy Me a Coffee
				</Clickable>
				<Clickable
					class="ep-btn ep-btn-outline tr-settings-action ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(TRUERECALL_GITHUB_URL, "_blank")}
				>
					<div ref={githubRef} class="ep:w-4 ep:h-4" />
					GitHub
				</Clickable>
			</div>
		</FormCard>
	);
}
