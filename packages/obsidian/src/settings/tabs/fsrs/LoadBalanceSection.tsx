import { useSignal } from "@preact/signals";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { ForecastRange } from "@true-recall/core/metrics/forecast-filter";
import type { TrueRecallSettings } from "@true-recall/core/types";

import {
	ActionButton,
	FormCard,
	FormField,
	SelectInput,
	SliderInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { WorkloadForecastSection } from "@true-recall/obsidian/features/metrics/ui/stats/components/WorkloadForecastSection";
import { t } from "@true-recall/obsidian/i18n";

import type { FsrsPluginHost } from "../../../types/plugin-host.types";
import { deferSettingsWork } from "../../defer-settings-work";
import { buildLoadBalanceForecast } from "./load-balance-forecast";
import { TargetInsights } from "./TargetInsights";
import { describeSuggestion, sliderMax } from "./target-copy";
import { useFsrsHelperOp } from "./useFsrsHelperOp";

interface LoadBalanceSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	plugin: FsrsPluginHost;
}

const TARGET_MODE_OPTIONS = [
	{
		value: "auto",
		get label() {
			return t("Automatic (suggested from your pace)");
		},
	},
	{
		value: "manual",
		get label() {
			return t("Manual");
		},
	},
];
const BALANCE_RANGE_OPTIONS = [
	{
		value: "30",
		get label() {
			return t("Next 30 days");
		},
	},
	{
		value: "60",
		get label() {
			return t("Next 60 days");
		},
	},
	{
		value: "90",
		get label() {
			return t("Next 90 days");
		},
	},
	{
		value: "0",
		get label() {
			return t("All future reviews");
		},
	},
];
const MAX_SHIFT_OPTIONS = [
	{
		value: "1",
		get label() {
			return t("1 day");
		},
	},
	{
		value: "3",
		get label() {
			return t("3 days");
		},
	},
	{
		value: "7",
		get label() {
			return t("7 days");
		},
	},
	{
		value: "14",
		get label() {
			return t("14 days");
		},
	},
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
	const forecastRange = useSignal<ForecastRange>("3m");
	const forecastKey = [
		forecastVersion,
		forecastRange.value,
		settings.loadBalanceTarget,
		settings.loadBalanceTargetMode,
		settings.loadBalanceMaxDeviation,
	].join(":");
	const [readyForecastKey, setReadyForecastKey] = useState<string | null>(null);

	// Let Preact commit the tab before starting collection-wide calculations.
	// The key also prevents a settings/range change from doing that work during
	// the interaction render; stale scheduled work is cancelled on cleanup.
	useEffect(() => {
		return deferSettingsWork(() => setReadyForecastKey(forecastKey));
	}, [forecastKey]);

	const forecastData = useMemo(() => {
		if (readyForecastKey !== forecastKey) return null;
		return buildLoadBalanceForecast(
			plugin,
			forecastRange.value,
			settings.loadBalanceMaxDeviation,
		);
	}, [
		plugin,
		readyForecastKey,
		forecastKey,
		forecastRange.value,
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
		<FormCard title={t("Load balance")}>
			<FormField
				name={t("Enable load balancing")}
				description={t(
					"Use load balancing rules when scheduling future reviews",
				)}
			>
				<ToggleInput
					value={settings.loadBalanceEnabled}
					onChange={(v) => void save({ loadBalanceEnabled: v })}
				/>
			</FormField>

			<FormField
				name={t("Daily target")}
				description={
					settings.loadBalanceTargetMode === "auto" && forecastData
						? describeSuggestion(forecastData.decision)
						: t("How the daily review target is determined")
				}
			>
				<SelectInput
					value={settings.loadBalanceTargetMode}
					options={TARGET_MODE_OPTIONS}
					onChange={(v) =>
						void save({
							loadBalanceTargetMode: v === "manual" ? "manual" : "auto",
						})
					}
				/>
			</FormField>

			{settings.loadBalanceTargetMode === "manual" && forecastData ? (
				<FormField
					name={t("Target daily reviews")}
					description={t(
						"Pick your number — the line below shows what it commits you to",
					)}
				>
					<SliderInput
						value={settings.loadBalanceTarget}
						onChange={(v) => void save({ loadBalanceTarget: Math.max(1, v) })}
						min={1}
						max={sliderMax(forecastData.decision, settings.loadBalanceTarget)}
						step={1}
						allowAboveMax
						formatTooltip={(v) => `${v}/day`}
						ariaLabel="Target daily reviews"
					/>
				</FormField>
			) : null}

			{forecastData ? (
				<TargetInsights
					decision={forecastData.decision}
					target={forecastData.decision.effectiveTarget}
				/>
			) : null}

			<FormField
				name={t("Maximum deviation (%)")}
				description={t(
					"Allow this much deviation from target before rebalancing",
				)}
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
				name={t("Maximum schedule shift")}
				description={t(
					"Largest day shift allowed when scheduling a newly reviewed card",
				)}
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
				name={t("Balance now range")}
				description={t("Range used only by the manual Balance now action")}
			>
				<SelectInput
					value={String(settings.loadBalanceBulkDays)}
					options={BALANCE_RANGE_OPTIONS}
					onChange={(v) => void save({ loadBalanceBulkDays: parseInt(v, 10) })}
				/>
			</FormField>

			<FormField
				name={t("Balance workload now")}
				description={t(
					"Apply load balancing immediately to scheduled reviews, spreading any overdue backlog from today forward",
				)}
			>
				<div class="ep:flex ep:items-center ep:gap-2">
					<ActionButton
						label={balancing ? t("Balancing...") : t("Balance now")}
						variant="secondary"
						disabled={balancing}
						onClick={handleBalance}
					/>
					{lastAffectedCount > 0 && (
						<ActionButton
							label={t("Undo ({0})", [lastAffectedCount])}
							variant="secondary"
							disabled={balancing}
							onClick={() => void handleUndo()}
						/>
					)}
				</div>
			</FormField>

			{forecastData ? (
				<div class="ep:mt-3">
					<WorkloadForecastSection
						forecast={forecastData.forecast}
						summary={forecastData.summary}
						dayOfWeek={forecastData.dayOfWeek}
						range={forecastRange}
					/>
				</div>
			) : (
				<p class="ep:mt-3 ep:text-xs ep:text-obs-muted ep:text-center ep:py-4">
					{t("Calculating workload forecast…")}
				</p>
			)}
		</FormCard>
	);
}
