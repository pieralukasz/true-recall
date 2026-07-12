import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { useMemo } from "preact/hooks";

import type { FSRSPreset, OptimizationMetrics } from "@true-recall/core/types";

import { usePlugin } from "@true-recall/obsidian/preact";

import { ChartCard } from "./ChartCard";

interface FSRSStatusCardProps {
	selectedPresets: Signal<Set<string>>;
}

interface PresetStatus {
	name: string;
	retention: number;
	weights: number[];
	lastOpt: string | null;
	metrics: OptimizationMetrics | null;
	reviewsSinceOpt: number | null;
	needsOptimization: boolean;
}

export function FSRSStatusCard({ selectedPresets }: FSRSStatusCardProps) {
	const plugin = usePlugin();

	const presetStatuses = useMemo((): PresetStatus[] => {
		const selected = selectedPresets.value;
		const statuses: PresetStatus[] = [];

		for (const name of selected) {
			const preset = plugin.presetService?.getPresetByName(name);
			if (!preset) continue;
			statuses.push(buildPresetStatus(preset, plugin));
		}

		return statuses.sort((a, b) => a.name.localeCompare(b.name));
	}, [plugin, selectedPresets.value]);

	if (presetStatuses.length === 0) {
		return (
			<ChartCard title="FSRS Status" subtitle="Optimization & parameters">
				<p class="ep:text-xs ep:text-obs-muted ep:py-4 ep:text-center">
					No presets selected
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="FSRS Status" subtitle="Optimization & parameters">
			<div class="ep:space-y-4">
				{presetStatuses.map((status) => (
					<PresetStatusEntry
						key={status.name}
						status={status}
						showName={presetStatuses.length > 1}
					/>
				))}
			</div>
		</ChartCard>
	);
}

function buildPresetStatus(
	preset: FSRSPreset,
	plugin: ReturnType<typeof usePlugin>,
): PresetStatus {
	const retention = Math.round(preset.requestRetention * 100);
	const weights = preset.weights ?? [];
	const lastOpt = preset.lastOptimization;
	const lastOptCount = preset.lastOptimizationReviewCount;
	const metrics = preset.lastOptimizationMetrics;

	let reviewCount = 0;
	try {
		reviewCount =
			plugin.cardStore?.stats?.getReviewCountForPreset(preset.name) ?? 0;
	} catch {
		// cardStore may not be available
	}

	const reviewsSinceOpt =
		lastOptCount != null ? Math.max(0, reviewCount - lastOptCount) : null;

	const needsOptimization =
		(!lastOpt && reviewCount >= 400) ||
		(reviewsSinceOpt != null && reviewsSinceOpt >= 1000);

	return {
		name: preset.name,
		retention,
		weights,
		lastOpt,
		metrics,
		reviewsSinceOpt,
		needsOptimization,
	};
}

function PresetStatusEntry({
	status,
	showName,
}: {
	status: PresetStatus;
	showName: boolean;
}) {
	const expanded = useSignal(false);

	return (
		<div
			class={
				showName
					? "ep:border-b ep:border-obs-modifier-border-hover ep:pb-3 ep:last:border-0 ep:last:pb-0"
					: ""
			}
		>
			<div class="ep:space-y-2.5">
				<div class="ep:flex ep:items-center ep:gap-2 ep:text-sm">
					{showName && (
						<span class="ep:font-medium ep:text-obs-normal">{status.name}</span>
					)}
					<span class="ep:text-xs ep:text-obs-muted">
						Target: {status.retention}%
					</span>
				</div>

				<div class="ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:text-xs ep:text-obs-muted">
					<span>
						Last optimized:{" "}
						{status.lastOpt ? formatRelativeDate(status.lastOpt) : "Never"}
					</span>
					{status.reviewsSinceOpt != null && (
						<span>{status.reviewsSinceOpt.toLocaleString()} reviews since</span>
					)}
				</div>

				{status.metrics && (
					<div class="ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:text-xs ep:text-obs-muted">
						<span>RMSE: {status.metrics.rmse.toFixed(4)}</span>
						<span>LogLoss: {status.metrics.logLoss.toFixed(4)}</span>
						<ConvergenceBadge status={status.metrics.convergenceStatus} />
					</div>
				)}

				{status.needsOptimization && (
					<div class="ep:text-xs ep:text-obs-orange ep:bg-obs-orange/10 ep:px-2.5 ep:py-1.5 ep:rounded">
						Optimization recommended — enough new reviews for better parameters
					</div>
				)}

				{status.weights.length > 0 && (
					<div class="ep:text-xs ep:text-obs-faint">
						<span
							class="ep:cursor-pointer tr-faux-underline-dotted"
							onClick={() => {
								expanded.value = !expanded.value;
							}}
							onKeyDown={(e: KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ")
									expanded.value = !expanded.value;
							}}
							role="button"
							tabIndex={0}
						>
							Weights ({status.weights.length}) {expanded.value ? "[-]" : "[+]"}
						</span>
						{expanded.value ? (
							<p class="ep:mt-1 ep:font-mono ep:break-all ep:leading-relaxed">
								[{status.weights.map((w) => w.toFixed(4)).join(", ")}]
							</p>
						) : (
							<span class="ep:ml-1.5 ep:font-mono">
								[
								{status.weights
									.slice(0, 4)
									.map((w) => w.toFixed(4))
									.join(", ")}
								, ...]
							</span>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function ConvergenceBadge({
	status,
}: {
	status: "converged" | "max_iterations" | "insufficient_data";
}) {
	const cls =
		status === "converged"
			? "ep:text-obs-green ep:bg-obs-green/10"
			: status === "insufficient_data"
				? "ep:text-obs-orange ep:bg-obs-orange/10"
				: "ep:text-obs-muted ep:bg-obs-modifier-hover";

	const label =
		status === "converged"
			? "Converged"
			: status === "insufficient_data"
				? "Insufficient data"
				: "Max iterations";

	return (
		<span class={`ep:px-1.5 ep:py-0.5 ep:rounded ep:text-xs ${cls}`}>
			{label}
		</span>
	);
}

function formatRelativeDate(isoDate: string): string {
	const date = new Date(isoDate);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${String(diffDays)} days ago`;
	if (diffDays < 30) return `${String(Math.floor(diffDays / 7))} weeks ago`;
	if (diffDays < 365) return `${String(Math.floor(diffDays / 30))} months ago`;
	return `${String(Math.floor(diffDays / 365))} years ago`;
}
