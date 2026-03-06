import type {
	FSRSPreset,
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
	TrueRecallSettings,
} from "@shared/types";
import {
	FormCard,
	FormField,
	SelectInput,
	TextInput,
} from "@shared/ui/components";

interface SchedulingSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
}

export function SchedulingSection({
	preset,
	updatePreset,
	settings,
	save,
}: SchedulingSectionProps) {
	return (
		<>
			<FormCard title="Learning steps">
				<FormField
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
				</FormField>

				<FormField
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
				</FormField>
			</FormCard>

			<FormCard title="Display order">
				<FormField
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
				</FormField>

				<FormField
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
				</FormField>

				<FormField
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
				</FormField>
			</FormCard>
		</>
	);
}
