import { useMemo, useState } from "preact/hooks";

import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	SliderInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { WorkloadForecastSection } from "@true-recall/obsidian/features/metrics/ui/stats/components/WorkloadForecastSection";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";
import { useFsrsHelperOp } from "./useFsrsHelperOp";

interface LoadBalanceSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: FsrsPluginHost;
}

const FORECAST_DAYS = 30;

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

	const {
		running: balancing,
		execute,
		lastAffectedCount,
		undoLast,
	} = useFsrsHelperOp(opConfig);

	const [forecastVersion, setForecastVersion] = useState(0);

	const forecastData = useMemo(() => {
		const helper = plugin.fsrsHelper;
		if (!helper) return null;
		void forecastVersion;
		return {
			forecast: helper.getWorkloadForecast(FORECAST_DAYS),
			summary: helper.getWorkloadForecastSummary(FORECAST_DAYS),
			dayOfWeek: helper.getWorkloadByDayOfWeek(FORECAST_DAYS),
		};
	}, [plugin.fsrsHelper, forecastVersion, settings.loadBalanceTarget]);

	const handleBalance = () => {
		execute(() => plugin.fsrsHelper?.balanceWorkload({ dryRun: false }));
		setForecastVersion((v) => v + 1);
	};

	const handleUndo = async () => {
		await undoLast();
		setForecastVersion((v) => v + 1);
	};

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
				<div class="ep:flex ep:items-center ep:gap-2">
					<ActionButton
						label={balancing ? "Balancing..." : "Balance now"}
						variant="secondary"
						disabled={balancing}
						onClick={handleBalance}
					/>
					{lastAffectedCount > 0 && (
						<ActionButton
							label={`Undo (${lastAffectedCount})`}
							variant="secondary"
							disabled={balancing}
							onClick={() => void handleUndo()}
						/>
					)}
				</div>
			</FormField>

			{forecastData && (
				<div class="ep:mt-3">
					<WorkloadForecastSection
						forecast={forecastData.forecast}
						summary={forecastData.summary}
						dayOfWeek={forecastData.dayOfWeek}
					/>
				</div>
			)}
		</FormCard>
	);
}
