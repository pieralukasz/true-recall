import { FSRS_CONFIG } from "@true-recall/core/constants";
import type { FSRSPreset, ReviewOrder } from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	SelectInput,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { REVIEW_ORDER_OPTIONS } from "@true-recall/obsidian/helpers";

interface SchedulingSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function SchedulingSection({
	preset,
	updatePreset,
}: SchedulingSectionProps) {
	return (
		<FormCard title="Scheduling">
			<FormField
				name="Desired retention"
				description={`Target recall probability (${FSRS_CONFIG.minRetention}\u2013${FSRS_CONFIG.maxRetention}). Default: 0.9`}
			>
				<SliderInput
					value={preset.requestRetention}
					onChange={(v) => void updatePreset({ requestRetention: v })}
					min={FSRS_CONFIG.minRetention}
					max={FSRS_CONFIG.maxRetention}
					step={0.01}
					formatTooltip={(v) => v.toFixed(2)}
				/>
			</FormField>

			<FormField
				name="Maximum interval (days)"
				description="Maximum days between reviews. Default: 36500"
			>
				<TextInput
					value={String(preset.maximumInterval)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 36500;
						void updatePreset({
							maximumInterval: Math.max(1, num),
						});
					}}
					placeholder="36500"
				/>
			</FormField>

			<FormField
				name="Fuzz review intervals"
				description="Randomize review intervals slightly to prevent cards from bunching on the same day"
			>
				<ToggleInput
					value={preset.enableFuzz !== false}
					onChange={(v) => void updatePreset({ enableFuzz: v })}
				/>
			</FormField>

			<FormField
				name="Review order"
				description="Order in which review cards are shown"
			>
				<SelectInput
					value={preset.reviewOrder ?? "due-date"}
					onChange={(v) => void updatePreset({ reviewOrder: v as ReviewOrder })}
					options={REVIEW_ORDER_OPTIONS}
				/>
			</FormField>
		</FormCard>
	);
}
