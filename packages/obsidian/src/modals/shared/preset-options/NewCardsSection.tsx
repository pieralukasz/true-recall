import type {
	FSRSPreset,
	NewCardOrder,
	NewReviewMix,
} from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	SelectInput,
	TextInput,
} from "@true-recall/obsidian/components";
import {
	NEW_CARD_ORDER_OPTIONS,
	NEW_REVIEW_MIX_OPTIONS,
} from "@true-recall/obsidian/helpers";

interface NewCardsSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function NewCardsSection({
	preset,
	updatePreset,
}: NewCardsSectionProps) {
	return (
		<FormCard title="New cards">
			<FormField
				name="Learning steps (minutes)"
				description="Comma-separated delays, e.g. 1, 10 = 1min then 10min"
			>
				<TextInput
					value={preset.learningSteps.join(", ")}
					onChange={(v) => {
						const steps = v
							.split(",")
							.map((s) => parseFloat(s.trim()))
							.filter((n) => !Number.isNaN(n) && n > 0);
						if (steps.length > 0) {
							void updatePreset({ learningSteps: steps });
						}
					}}
					placeholder="1, 10"
				/>
			</FormField>

			<FormField
				name="New card order"
				description="Order in which new cards are introduced"
			>
				<SelectInput
					value={preset.newCardOrder ?? "random"}
					onChange={(v) =>
						void updatePreset({ newCardOrder: v as NewCardOrder })
					}
					options={NEW_CARD_ORDER_OPTIONS}
				/>
			</FormField>

			<FormField
				name="Mix with reviews"
				description="How new cards are interspersed with review cards"
			>
				<SelectInput
					value={preset.newReviewMix ?? "mix-with-reviews"}
					onChange={(v) =>
						void updatePreset({ newReviewMix: v as NewReviewMix })
					}
					options={NEW_REVIEW_MIX_OPTIONS}
				/>
			</FormField>
		</FormCard>
	);
}
