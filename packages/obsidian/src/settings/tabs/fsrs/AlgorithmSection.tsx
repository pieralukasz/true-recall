import { FSRS_CONFIG } from "@true-recall/core/constants";
import type { FSRSPreset } from "@true-recall/core/types";

import {
	FormCard,
	FormField,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";

interface AlgorithmSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

export function AlgorithmSection({
	preset,
	updatePreset,
}: AlgorithmSectionProps) {
	return (
		<FormCard title={t("FSRS algorithm")}>
			<FormField
				name={t("Desired retention")}
				description={t(
					"Target probability of recall ({0}-{1}). Default: 0.9 (90%)",
					[FSRS_CONFIG.minRetention, FSRS_CONFIG.maxRetention],
				)}
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
				name={t("Maximum interval (days)")}
				description={t(
					"Maximum days between reviews. Default: 36500 (100 years)",
				)}
			>
				<TextInput
					value={String(preset.maximumInterval)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 36500;
						void updatePreset({ maximumInterval: Math.max(1, num) });
					}}
					placeholder="36500"
					class="tr-control--compact"
				/>
			</FormField>

			<FormField
				name={t("Fuzz review intervals")}
				description={t(
					"Randomize review intervals slightly to prevent cards from bunching on the same day",
				)}
			>
				<ToggleInput
					value={preset.enableFuzz !== false}
					onChange={(v) => void updatePreset({ enableFuzz: v })}
				/>
			</FormField>
		</FormCard>
	);
}
