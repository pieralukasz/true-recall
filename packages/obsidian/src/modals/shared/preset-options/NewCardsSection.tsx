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

interface NewCardsSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

const ORDER_OPTIONS = [
	{ value: "random", label: "Random" },
	{ value: "oldest-first", label: "Oldest first" },
	{ value: "newest-first", label: "Newest first" },
];

const MIX_OPTIONS = [
	{ value: "mix-with-reviews", label: "Mix with reviews" },
	{ value: "show-after-reviews", label: "Show after reviews" },
	{ value: "show-before-reviews", label: "Show before reviews" },
];

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
					options={ORDER_OPTIONS}
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
					options={MIX_OPTIONS}
				/>
			</FormField>
		</FormCard>
	);
}
