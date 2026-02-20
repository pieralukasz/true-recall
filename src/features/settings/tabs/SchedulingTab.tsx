import type { NewCardOrder, NewReviewMix, ReviewOrder } from "../../../shared/types";
import {
	InfoBlock,
	SelectInput,
	SettingRow,
	TextInput,
} from "../../../shared/ui/components";
import { usePreset, useSettings } from "../hooks/useSettings";

interface SchedulingTabProps {
	selectedPresetId: string;
}

export function SchedulingTab({ selectedPresetId }: SchedulingTabProps) {
	const { settings, save } = useSettings();
	const { preset, updatePreset } = usePreset(selectedPresetId);

	return (
		<>
			<SettingRow heading name="Learning steps" />

			<InfoBlock>
				<p>
					Learning steps are configured per-preset. Currently editing: "
					{preset.name}". Change preset in the FSRS tab.
				</p>
			</InfoBlock>

			<SettingRow
				name="Learning steps (minutes)"
				description="Comma-separated steps for new cards. Default: 1, 10"
			>
				<TextInput
					value={preset.learningSteps.join(", ")}
					onChange={(v) => {
						const steps = v
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !Number.isNaN(n) && n > 0);
						void updatePreset({
							learningSteps: steps.length > 0 ? steps : [1, 10],
						});
					}}
					placeholder="1, 10"
				/>
			</SettingRow>

			<SettingRow
				name="Relearning steps (minutes)"
				description="Comma-separated steps for lapsed cards. Default: 10"
			>
				<TextInput
					value={preset.relearningSteps.join(", ")}
					onChange={(v) => {
						const steps = v
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !Number.isNaN(n) && n > 0);
						void updatePreset({
							relearningSteps: steps.length > 0 ? steps : [10],
						});
					}}
					placeholder="10"
				/>
			</SettingRow>

			<SettingRow heading name="Display order" />

			<SettingRow
				name="New card order"
				description="How to order new cards in the review queue"
			>
				<SelectInput
					value={settings.newCardOrder}
					onChange={(v) => save({ newCardOrder: v as NewCardOrder })}
					options={[
						{ value: "random", label: "Random" },
						{
							value: "oldest-first",
							label: "Oldest first (by position in file)",
						},
						{
							value: "newest-first",
							label: "Newest first (by position in file)",
						},
					]}
				/>
			</SettingRow>

			<SettingRow
				name="Review order"
				description="How to order cards due for review"
			>
				<SelectInput
					value={settings.reviewOrder}
					onChange={(v) => save({ reviewOrder: v as ReviewOrder })}
					options={[
						{ value: "due-date", label: "By due date" },
						{ value: "random", label: "Random" },
						{ value: "due-date-random", label: "Due date, then random" },
						{
							value: "by-retrievability",
							label: "By retrievability (lowest R first)",
						},
					]}
				/>
			</SettingRow>

			<SettingRow
				name="New/review mix"
				description="When to show new cards relative to reviews"
			>
				<SelectInput
					value={settings.newReviewMix}
					onChange={(v) => save({ newReviewMix: v as NewReviewMix })}
					options={[
						{ value: "mix-with-reviews", label: "Mix with reviews" },
						{ value: "show-after-reviews", label: "Show after reviews" },
						{ value: "show-before-reviews", label: "Show before reviews" },
					]}
				/>
			</SettingRow>
		</>
	);
}
