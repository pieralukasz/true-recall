import type {
	FSRSPreset,
	NewCardOrder,
	NewReviewMix,
	ReviewOrder,
} from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	SelectInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import {
	NEW_CARD_ORDER_OPTIONS,
	NEW_REVIEW_MIX_OPTIONS,
	REVIEW_ORDER_OPTIONS,
} from "@true-recall/obsidian/helpers";
import { t } from "@true-recall/obsidian/i18n";

interface SchedulingSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function SchedulingSection({
	preset,
	updatePreset,
}: SchedulingSectionProps) {
	return (
		<>
			<FormCard title={t("Learning steps")}>
				<FormField
					name={t("Learning steps (minutes)")}
					description={t("Comma-separated steps for new cards. Default: 1, 10")}
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
						class="tr-control--steps"
					/>
				</FormField>

				<FormField
					name={t("Relearning steps (minutes)")}
					description={t("Comma-separated steps for lapsed cards. Default: 10")}
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
						class="tr-control--steps"
					/>
				</FormField>
			</FormCard>

			<FormCard title={t("Display order")}>
				<FormField
					name={t("New card order")}
					description={t("How to order new cards in the review queue")}
				>
					<SelectInput
						value={preset.newCardOrder ?? "random"}
						onChange={(v) =>
							void updatePreset({ newCardOrder: v as NewCardOrder })
						}
						options={NEW_CARD_ORDER_OPTIONS.map((option) => ({
							...option,
							label: t(option.label),
						}))}
					/>
				</FormField>

				<FormField
					name={t("Review order")}
					description={t("How to order cards due for review")}
				>
					<SelectInput
						value={preset.reviewOrder ?? "due-date"}
						onChange={(v) =>
							void updatePreset({ reviewOrder: v as ReviewOrder })
						}
						options={REVIEW_ORDER_OPTIONS.map((option) => ({
							...option,
							label: t(option.label),
						}))}
					/>
				</FormField>

				<FormField
					name={t("New/review mix")}
					description={t("When to show new cards relative to reviews")}
				>
					<SelectInput
						value={preset.newReviewMix ?? "mix-with-reviews"}
						onChange={(v) =>
							void updatePreset({ newReviewMix: v as NewReviewMix })
						}
						options={NEW_REVIEW_MIX_OPTIONS.map((option) => ({
							...option,
							label: t(option.label),
						}))}
					/>
				</FormField>
			</FormCard>

			<FormCard title={t("Siblings")}>
				<FormField
					name={t("Bury sibling cards")}
					description={t(
						"After reviewing an image occlusion or cloze card, bury remaining cards from the same note until next day. This is not recommended; leaving it off keeps siblings spaced apart in the queue.",
					)}
				>
					<ToggleInput
						value={preset.burySiblings !== false}
						onChange={(v) => void updatePreset({ burySiblings: v })}
					/>
				</FormField>
			</FormCard>
		</>
	);
}
