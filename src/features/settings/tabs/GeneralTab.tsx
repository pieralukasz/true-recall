import { useSettings } from "@features/settings/hooks/useSettings";
import type { ReviewViewMode } from "@shared/types";
import {
	FormCard,
	FormField,
	SelectInput,
	SliderInput,
	ToggleInput,
} from "@shared/ui/components";

export function GeneralTab() {
	const { settings, save } = useSettings();

	return (
		<div class="ep:flex ep:flex-col ep:gap-3">
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

			<FormCard title="Flashcard collection">
				<FormField
					name="Remove content after collecting"
					description="Removes the entire flashcard (Q+A) from markdown after collecting. When disabled, only removes the #flashcard tag"
				>
					<ToggleInput
						value={settings.removeFlashcardContentAfterCollect}
						onChange={(v) => save({ removeFlashcardContentAfterCollect: v })}
					/>
				</FormField>
			</FormCard>
		</div>
	);
}
