import type { OptimizationMetrics } from "@shared/types";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { ChartCard } from "./ChartCard";

export function FSRSStatusCard() {
	const plugin = usePlugin();
	const expanded = useSignal(false);

	const data = useMemo(() => {
		const settings = plugin.settings;
		const presets = plugin.presetService?.getPresets?.() ?? [];
		const presetName =
			presets.length > 0 ? (presets[0]?.name ?? "Default") : "Default";
		const retention = Math.round(
			(settings.fsrsRequestRetention ?? 0.9) * 100,
		);
		const weights = settings.fsrsWeights ?? [];
		const lastOpt = settings.lastOptimization;
		const lastOptCount = settings.lastOptimizationReviewCount;
		const metrics = settings.lastOptimizationMetrics as OptimizationMetrics | null;

		// Total reviews for "reviews since optimization"
		let totalReviews = 0;
		try {
			const cards = plugin.cardStore?.getCards?.();
			if (cards) totalReviews = cards.length;
		} catch {
			// cardStore may not expose total review count directly
		}

		const reviewsSinceOpt =
			lastOptCount != null ? Math.max(0, totalReviews - lastOptCount) : null;

		const needsOptimization =
			(!lastOpt && totalReviews >= 400) ||
			(reviewsSinceOpt != null && reviewsSinceOpt >= 1000);

		return {
			presetName,
			retention,
			weights,
			lastOpt,
			metrics,
			reviewsSinceOpt,
			needsOptimization,
		};
	}, [plugin]);

	return (
		<ChartCard title="FSRS Status" subtitle="Optimization & parameters">
			<div class="ep:space-y-2.5">
				{/* Preset + Retention */}
				<div class="ep:flex ep:items-center ep:gap-2 ep:text-sm">
					<span class="ep:font-medium ep:text-obs-normal">
						{data.presetName}
					</span>
					<span class="ep:text-xs ep:text-obs-muted">
						Target: {data.retention}%
					</span>
				</div>

				{/* Last Optimized */}
				<div class="ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:text-xs ep:text-obs-muted">
					<span>
						Last optimized:{" "}
						{data.lastOpt ? formatRelativeDate(data.lastOpt) : "Never"}
					</span>
					{data.reviewsSinceOpt != null && (
						<span>
							{data.reviewsSinceOpt.toLocaleString()} reviews since
						</span>
					)}
				</div>

				{/* Optimization Metrics */}
				{data.metrics && (
					<div class="ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:text-xs ep:text-obs-muted">
						<span>RMSE: {data.metrics.rmse.toFixed(4)}</span>
						<span>LogLoss: {data.metrics.logLoss.toFixed(4)}</span>
						<ConvergenceBadge status={data.metrics.convergenceStatus} />
					</div>
				)}

				{/* Recommendation */}
				{data.needsOptimization && (
					<div class="ep:text-xs ep:text-obs-orange ep:bg-obs-orange/10 ep:px-2.5 ep:py-1.5 ep:rounded">
						Optimization recommended — enough new reviews for better parameters
					</div>
				)}

				{/* Weights */}
				{data.weights.length > 0 && (
					<div class="ep:text-xs ep:text-obs-faint">
						<span
							class="ep:cursor-pointer ep:underline ep:decoration-dotted"
							onClick={() => {
								expanded.value = !expanded.value;
							}}
						>
							Weights ({data.weights.length}){" "}
							{expanded.value ? "[-]" : "[+]"}
						</span>
						{expanded.value ? (
							<p class="ep:mt-1 ep:font-mono ep:break-all ep:leading-relaxed">
								[{data.weights.map((w) => w.toFixed(4)).join(", ")}]
							</p>
						) : (
							<span class="ep:ml-1.5 ep:font-mono">
								[
								{data.weights
									.slice(0, 4)
									.map((w) => w.toFixed(4))
									.join(", ")}
								, ...]
							</span>
						)}
					</div>
				)}
			</div>
		</ChartCard>
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
