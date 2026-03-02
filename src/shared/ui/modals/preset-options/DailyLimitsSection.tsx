import type { FSRSPreset } from "@shared/types";
import { SettingRow, TextInput } from "@shared/ui/components";

interface DailyLimitsSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function DailyLimitsSection({
	preset,
	updatePreset,
}: DailyLimitsSectionProps) {
	return (
		<>
			<SettingRow heading name="Daily limits" />

			<SettingRow
				name="New cards per day"
				description="Maximum new cards introduced per day"
			>
				<TextInput
					value={String(preset.newCardsPerDay)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 20;
						void updatePreset({ newCardsPerDay: Math.max(0, num) });
					}}
					placeholder="20"
				/>
			</SettingRow>

			<SettingRow
				name="Reviews per day"
				description="Maximum reviews per day (0 = unlimited)"
			>
				<TextInput
					value={String(preset.reviewsPerDay)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 200;
						void updatePreset({ reviewsPerDay: Math.max(0, num) });
					}}
					placeholder="200"
				/>
			</SettingRow>
		</>
	);
}
