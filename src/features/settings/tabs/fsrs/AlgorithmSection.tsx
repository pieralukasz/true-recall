import { FSRS_CONFIG } from "@shared/constants";
import type { FSRSPreset } from "@shared/types";
import { SettingRow, SliderInput, TextInput } from "@shared/ui/components";

interface AlgorithmSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function AlgorithmSection({
	preset,
	updatePreset,
}: AlgorithmSectionProps) {
	return (
		<>
			<SettingRow heading name="FSRS algorithm" />

			<SettingRow
				name="Desired retention"
				description={`Target probability of recall (${FSRS_CONFIG.minRetention}-${FSRS_CONFIG.maxRetention}). Default: 0.9 (90%)`}
			>
				<SliderInput
					value={preset.requestRetention}
					onChange={(v) => void updatePreset({ requestRetention: v })}
					min={FSRS_CONFIG.minRetention}
					max={FSRS_CONFIG.maxRetention}
					step={0.01}
					formatTooltip={(v) => v.toFixed(2)}
				/>
			</SettingRow>

			<SettingRow
				name="Maximum interval (days)"
				description="Maximum days between reviews. Default: 36500 (100 years)"
			>
				<TextInput
					value={String(preset.maximumInterval)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 36500;
						void updatePreset({ maximumInterval: Math.max(1, num) });
					}}
					placeholder="36500"
				/>
			</SettingRow>
		</>
	);
}
