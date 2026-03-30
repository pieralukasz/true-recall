import { useFsrsHelperOp } from "@features/settings/tabs/fsrs/useFsrsHelperOp";
import type { TrueRecallSettings } from "@shared/types";
import type { FsrsPluginHost } from "@shared/types/plugin-host.types";
import {
	ActionButton,
	FormCard,
	FormField,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@shared/ui/components";
import { useMemo } from "preact/hooks";

interface LoadBalanceSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: FsrsPluginHost;
}

export function LoadBalanceSection({
	settings,
	save,
	plugin,
}: LoadBalanceSectionProps) {
	const opConfig = useMemo(
		() => ({
			plugin,
			operationName: "balance-workload" as const,
			undoDescription: (n: number) => `Balance workload (${n} cards)`,
			successMessage: (n: number) => `Balanced ${n} cards (Ctrl+Z to undo)`,
			emptyMessage: "No cards needed balancing",
			errorPrefix: "Balance failed",
		}),
		[plugin],
	);

	const { running: balancing, execute } = useFsrsHelperOp(opConfig);

	return (
		<FormCard title="Load balance">
			<FormField
				name="Enable load balancing"
				description="Automatically distribute reviews to prevent workload spikes"
			>
				<ToggleInput
					value={settings.loadBalanceEnabled}
					onChange={(v) => void save({ loadBalanceEnabled: v })}
				/>
			</FormField>

			<FormField
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
			</FormField>

			<FormField
				name="Maximum deviation (%)"
				description="Allow this much deviation from target before rebalancing"
			>
				<SliderInput
					value={settings.loadBalanceMaxDeviation}
					onChange={(v) => void save({ loadBalanceMaxDeviation: v })}
					min={0}
					max={50}
					step={5}
					formatTooltip={(v) => `${v}%`}
				/>
			</FormField>

			<FormField
				name="Balance workload now"
				description="Redistribute reviews for the next 30 days"
			>
				<ActionButton
					label={balancing ? "Balancing..." : "Balance now"}
					variant="secondary"
					disabled={balancing}
					onClick={() =>
						void execute(() =>
							plugin.fsrsHelper?.balanceWorkload({ dryRun: false }),
						)
					}
				/>
			</FormField>
		</FormCard>
	);
}
