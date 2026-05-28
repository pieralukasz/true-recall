import { useCallback, useRef, useState } from "preact/hooks";

import {
	DEFAULT_SETTINGS,
	TRUERECALL_BMC_URL,
	TRUERECALL_DISCORD_URL,
	TRUERECALL_GITHUB_URL,
	TRUERECALL_WEB_URL,
} from "@true-recall/core/constants";
import type {
	ReviewContentWidth,
	ReviewKeybindings,
	ReviewViewMode,
} from "@true-recall/core/types";

import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
	SelectInput,
	SliderInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { KeyboardHandler } from "@true-recall/obsidian/features/study/ui/review/handlers/KeyboardHandler";
import { useIcon } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { useSettings } from "../hooks/useSettings";

export function GeneralTab() {
	const { settings, save, plugin } = useSettings();

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
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
				<div class="ep:text-ui-smallest ep:text-red-500 ep:mt-1">{error}</div>
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
