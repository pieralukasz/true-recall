import { useMemo, useState } from "preact/hooks";

import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	SelectInput,
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
const BALANCE_RANGE_OPTIONS = [
	{ value: "30", label: "Next 30 days" },
	{ value: "60", label: "Next 60 days" },
	{ value: "90", label: "Next 90 days" },
	{ value: "0", label: "All future reviews" },
];
const MAX_SHIFT_OPTIONS = [
	{ value: "1", label: "1 day" },
	{ value: "3", label: "3 days" },
	{ value: "7", label: "7 days" },
	{ value: "14", label: "14 days" },
];

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
		// forecastVersion, loadBalanceTarget, and loadBalanceMaxDeviation are read
		// here only to force recomputation — helper.getWorkloadForecast() etc.
		// read live settings internally, so nothing here references them directly.
		// Without this, the forecast would go stale after editing the target or
		// deviation sliders below (they only call `save`, not setForecastVersion).
		void forecastVersion;
		void settings.loadBalanceTarget;
		void settings.loadBalanceMaxDeviation;
		return {
			forecast: helper.getWorkloadForecast(FORECAST_DAYS),
			summary: helper.getWorkloadForecastSummary(FORECAST_DAYS),
			dayOfWeek: helper.getWorkloadByDayOfWeek(FORECAST_DAYS),
		};
	}, [
		plugin.fsrsHelper,
		forecastVersion,
		settings.loadBalanceTarget,
		settings.loadBalanceMaxDeviation,
	]);

	const handleBalance = () => {
		execute(() =>
			plugin.fsrsHelper?.balanceWorkload({
				days: settings.loadBalanceBulkDays,
				dryRun: false,
			}),
		);
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
				description="Use load balancing rules when scheduling future reviews"
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
				name="Maximum schedule shift"
				description="Largest day shift allowed when scheduling a newly reviewed card"
			>
				<SelectInput
					value={String(settings.loadBalanceMaxShiftDays)}
					options={MAX_SHIFT_OPTIONS}
					onChange={(v) =>
						void save({ loadBalanceMaxShiftDays: parseInt(v, 10) })
					}
				/>
			</FormField>

			<FormField
				name="Balance now range"
				description="Range used only by the manual Balance now action"
			>
				<SelectInput
					value={String(settings.loadBalanceBulkDays)}
					options={BALANCE_RANGE_OPTIONS}
					onChange={(v) => void save({ loadBalanceBulkDays: parseInt(v, 10) })}
				/>
			</FormField>

			<FormField
				name="Balance workload now"
				description="Apply load balancing immediately to existing scheduled reviews"
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
