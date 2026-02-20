import { useSettings } from "@features/settings/hooks/useSettings";
import type { ReviewViewMode } from "@shared/types";
import {
	SelectInput,
	SettingRow,
	SliderInput,
	ToggleInput,
} from "@shared/ui/components";

export function GeneralTab() {
	const { settings, save } = useSettings();

	return (
		<>
			<SettingRow heading name="Review interface" />

			<SettingRow
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
			</SettingRow>

			<SettingRow
				name="Show review header"
				description="Display header with close button, stats and progress in review session"
			>
				<ToggleInput
					value={settings.showReviewHeader}
					onChange={(v) => save({ showReviewHeader: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Show header stats"
				description="Display new/learning/due counters in review session header"
			>
				<ToggleInput
					value={settings.showReviewHeaderStats}
					onChange={(v) => save({ showReviewHeaderStats: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Show next review time"
				description="Display predicted interval on answer buttons"
			>
				<ToggleInput
					value={settings.showNextReviewTime}
					onChange={(v) => save({ showNextReviewTime: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Continuous custom reviews"
				description="Show 'Next session' button after completing a custom review session"
			>
				<ToggleInput
					value={settings.continuousCustomReviews}
					onChange={(v) => save({ continuousCustomReviews: v })}
				/>
			</SettingRow>

			<SettingRow heading name="Editor integration" />

			<SettingRow
				name="Show link status indicators"
				description="Display inline flashcard counts (new/learning/review) next to [[links]] that point to notes with flashcards"
			>
				<ToggleInput
					value={settings.showLinkStatusIndicators}
					onChange={(v) => save({ showLinkStatusIndicators: v })}
				/>
			</SettingRow>

			<SettingRow heading name="Day boundary" />

			<SettingRow
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
			</SettingRow>

			<SettingRow heading name="Flashcard collection" />

			<SettingRow
				name="Remove content after collecting"
				description="Removes the entire flashcard (Q+A) from markdown after collecting. When disabled, only removes the #flashcard tag"
			>
				<ToggleInput
					value={settings.removeFlashcardContentAfterCollect}
					onChange={(v) => save({ removeFlashcardContentAfterCollect: v })}
				/>
			</SettingRow>
		</>
	);
}
