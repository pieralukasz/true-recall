import { useMemo } from "preact/hooks";
import type { TrueRecallSettings } from "../../../../shared/types";
import {
	ActionButton,
	SettingRow,
	SliderInput,
	TextInput,
	ToggleInput,
} from "../../../../shared/ui/components";
import { useFsrsHelperOp } from "./useFsrsHelperOp";

interface LoadBalanceSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: any;
}

export function LoadBalanceSection({ settings, save, plugin }: LoadBalanceSectionProps) {
	const opConfig = useMemo(
		() => ({
			plugin,
			operationName: "balance-workload",
			undoDescription: (n: number) => `Balance workload (${n} cards)`,
			successMessage: (n: number) => `Balanced ${n} cards (Ctrl+Z to undo)`,
			emptyMessage: "No cards needed balancing",
			errorPrefix: "Balance failed",
		}),
		[plugin],
	);

	const { running: balancing, execute } = useFsrsHelperOp(opConfig);

	return (
		<>
			<SettingRow heading name="Load balance" />

			<SettingRow
				name="Enable load balancing"
				description="Automatically distribute reviews to prevent workload spikes"
			>
				<ToggleInput
					value={settings.loadBalanceEnabled}
					onChange={(v) => save({ loadBalanceEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Target daily reviews"
				description="Target number of reviews per day for balancing"
			>
				<TextInput
					value={String(settings.loadBalanceTarget)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 100;
						void save({ loadBalanceTarget: Math.max(1, num) });
					}}
					placeholder="100"
				/>
			</SettingRow>

			<SettingRow
				name="Maximum deviation (%)"
				description="Allow this much deviation from target before rebalancing"
			>
				<SliderInput
					value={settings.loadBalanceMaxDeviation}
					onChange={(v) => save({ loadBalanceMaxDeviation: v })}
					min={0}
					max={50}
					step={5}
					formatTooltip={(v) => `${v}%`}
				/>
			</SettingRow>

			<SettingRow
				name="Balance workload now"
				description="Redistribute reviews for the next 30 days"
			>
				<ActionButton
					label={balancing ? "Balancing..." : "Balance now"}
					variant="secondary"
					disabled={balancing}
					onClick={() =>
						execute(() =>
							plugin.fsrsHelper?.balanceWorkload({ dryRun: false }),
						)
					}
				/>
			</SettingRow>
		</>
	);
}
