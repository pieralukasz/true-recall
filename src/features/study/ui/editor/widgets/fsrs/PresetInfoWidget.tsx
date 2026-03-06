import { useComputed } from "@preact/signals";
import { cards, pluginSettings } from "@shared/services/reactive-card-store";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

function formatSteps(steps: number[]): string {
	return steps
		.map((s) => (s >= 60 ? `${Math.round(s / 60)}h` : `${s}m`))
		.join(", ");
}

function formatDaysAgo(isoDate: string): { text: string; stale: boolean } {
	const then = new Date(isoDate).getTime();
	const daysAgo = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
	if (daysAgo === 0) return { text: "today", stale: false };
	if (daysAgo === 1) return { text: "yesterday", stale: false };
	return { text: `${daysAgo} days ago`, stale: daysAgo > 30 };
}

export function PresetInfoWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const presetName = configValue(config, "preset", "") as string;
	const showWeights = configValue(config, "showWeights", false);
	const showLimits = configValue(config, "showLimits", true);

	const preset = useComputed(() => {
		cards.value;
		pluginSettings.value;
		if (presetName) {
			return plugin.presetService.getPresetByName(presetName) ?? null;
		}
		try {
			return plugin.presetService.getDefaultPreset();
		} catch {
			return null;
		}
	}).value;

	if (!preset) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				{presetName
					? `Preset "${presetName}" not found`
					: "No FSRS presets configured"}
			</div>
		);
	}

	const presetReviews =
		plugin.cardStore?.stats?.getReviewCountForPreset(preset.name) ?? 0;
	const reviewsSinceOpt =
		preset.lastOptimizationReviewCount != null
			? presetReviews - preset.lastOptimizationReviewCount
			: presetReviews;
	const needsOptimization =
		!preset.lastOptimization ||
		reviewsSinceOpt > 500 ||
		formatDaysAgo(preset.lastOptimization).stale;

	const handleClick = () => {
		plugin.openStatsView().catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Header */}
			<Clickable
				class="ep:flex ep:items-center ep:justify-between"
				onClick={handleClick}
				title="Open statistics"
			>
				<span class="ep:font-semibold ep:text-xs">{preset.name}</span>
				<span class="ep:text-xs ep:text-obs-muted">FSRS Preset</span>
			</Clickable>

			{/* Parameters grid */}
			<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:text-xs">
				<ParamRow
					label="Retention"
					value={`${Math.round(preset.requestRetention * 100)}%`}
				/>
				<ParamRow label="Max interval" value={`${preset.maximumInterval}d`} />
				{showLimits && (
					<>
						<ParamRow label="New/day" value={String(preset.newCardsPerDay)} />
						<ParamRow
							label="Reviews/day"
							value={String(preset.reviewsPerDay)}
						/>
					</>
				)}
				<ParamRow
					label="Learn steps"
					value={
						preset.learningSteps.length > 0
							? formatSteps(preset.learningSteps)
							: "none"
					}
				/>
				<ParamRow
					label="Relearn steps"
					value={
						preset.relearningSteps.length > 0
							? formatSteps(preset.relearningSteps)
							: "none"
					}
				/>
			</div>

			{/* Optimization status */}
			<Clickable
				class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:pt-1 ep:border-t ep:border-obs-modifier-border"
				onClick={handleClick}
				title="Open statistics to optimize"
			>
				<OptimizationStatus
					lastOptimization={preset.lastOptimization}
					needsOptimization={needsOptimization}
					reviewsSinceOpt={reviewsSinceOpt}
					metrics={preset.lastOptimizationMetrics}
				/>
			</Clickable>

			{/* Weights (optional) */}
			{showWeights && preset.weights && (
				<div class="ep:text-xs ep:text-obs-muted ep:pt-1 ep:border-t ep:border-obs-modifier-border">
					<div class="ep:font-medium ep:mb-1">
						Weights ({preset.weights.length})
					</div>
					<div class="ep:font-mono ep:text-[10px] ep:leading-relaxed ep:break-all">
						{preset.weights.map((w) => w.toFixed(4)).join(", ")}
					</div>
				</div>
			)}
		</div>
	);
}

function ParamRow({ label, value }: { label: string; value: string }) {
	return (
		<div class="ep:flex ep:items-center ep:justify-between">
			<span class="ep:text-obs-muted">{label}</span>
			<span class="ep:font-medium">{value}</span>
		</div>
	);
}

function OptimizationStatus({
	lastOptimization,
	needsOptimization,
	reviewsSinceOpt,
	metrics,
}: {
	lastOptimization: string | null;
	needsOptimization: boolean;
	reviewsSinceOpt: number;
	metrics: { rmse: number; logLoss: number; convergenceStatus: string } | null;
}) {
	if (!lastOptimization) {
		return (
			<>
				<span
					class="ep:inline-block ep:w-2 ep:h-2 ep:rounded-full"
					style={{ background: "var(--color-red)" }}
				/>
				<span style={{ color: "var(--color-red)" }}>Never optimized</span>
				{reviewsSinceOpt > 0 && (
					<span class="ep:text-obs-muted ep:ml-auto">
						{reviewsSinceOpt} reviews available
					</span>
				)}
			</>
		);
	}

	const { text, stale } = formatDaysAgo(lastOptimization);
	const color = needsOptimization
		? "var(--color-orange)"
		: "var(--color-green)";

	return (
		<>
			<span
				class="ep:inline-block ep:w-2 ep:h-2 ep:rounded-full"
				style={{ background: color }}
			/>
			<span>
				Optimized <span style={{ color }}>{text}</span>
			</span>
			{metrics && (
				<span class="ep:text-obs-muted">RMSE: {metrics.rmse.toFixed(4)}</span>
			)}
			{needsOptimization && (
				<span
					class="ep:ml-auto ep:font-medium"
					style={{ color: "var(--color-orange)" }}
				>
					Optimize &rarr;
				</span>
			)}
			{!needsOptimization && reviewsSinceOpt > 0 && (
				<span class="ep:text-obs-muted ep:ml-auto">
					+{reviewsSinceOpt} reviews
				</span>
			)}
		</>
	);
}
