import type { FSRSPreset } from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	TextInput,
} from "@true-recall/obsidian/components";

interface DailyLimitsSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function DailyLimitsSection({
	preset,
	updatePreset,
}: DailyLimitsSectionProps) {
	return (
		<FormCard title="Daily limits">
			<FormField
				name="New cards per day"
				description="Maximum number of new cards introduced per day"
			>
				<TextInput
					value={String(preset.newCardsPerDay)}
					onChange={(v) => {
						const parsed = parseInt(v, 10);
						const num = Number.isNaN(parsed) ? 20 : parsed;
						void updatePreset({ newCardsPerDay: Math.max(0, num) });
					}}
					placeholder="20"
				/>
			</FormField>

			<FormField
				name="Reviews per day"
				description="Maximum number of reviews per day (0 = unlimited)"
			>
				<TextInput
					value={String(preset.reviewsPerDay)}
					onChange={(v) => {
						const parsed = parseInt(v, 10);
						const num = Number.isNaN(parsed) ? 200 : parsed;
						void updatePreset({ reviewsPerDay: Math.max(0, num) });
					}}
					placeholder="200"
				/>
			</FormField>
		</FormCard>
	);
}
