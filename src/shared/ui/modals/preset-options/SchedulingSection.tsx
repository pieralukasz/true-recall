import { FSRS_CONFIG } from "@shared/constants";
import type { FSRSPreset, ReviewOrder } from "@shared/types";
import { SelectInput, SettingRow, SliderInput, TextInput } from "@shared/ui/components";

interface SchedulingSectionProps {
	preset: FSRSPreset;
	updatePreset: (c: Partial<FSRSPreset>) => Promise<void>;
}

const REVIEW_ORDER_OPTIONS = [
	{ value: "due-date", label: "Due date" },
	{ value: "due-date-random", label: "Due date + random" },
	{ value: "random", label: "Random" },
	{ value: "by-retrievability", label: "By retrievability" },
	{ value: "relative-overdueness", label: "Relative overdueness" },
	{ value: "most-lapses", label: "Most lapses first" },
	{ value: "lowest-stability", label: "Lowest stability" },
	{ value: "order-added", label: "Order added" },
];

export function SchedulingSection({
	preset,
	updatePreset,
}: SchedulingSectionProps) {
	return (
		<>
			<SettingRow heading name="Scheduling" />

			<SettingRow
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
			</SettingRow>

			<SettingRow
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
			</SettingRow>

			<SettingRow
				name="Review order"
				description="Order in which review cards are shown"
			>
				<SelectInput
					value={preset.reviewOrder ?? "due-date"}
					onChange={(v) =>
						void updatePreset({ reviewOrder: v as ReviewOrder })
					}
					options={REVIEW_ORDER_OPTIONS}
				/>
			</SettingRow>
		</>
	);
}
