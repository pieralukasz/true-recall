import { useComputed } from "@preact/signals";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { CollectionHealthSnapshot } from "@true-recall/core/types/fsrs/stats.types";
import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

export function HealthWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): CollectionHealthSnapshot | null => {
		void allMeta.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		return statsCalc.getCollectionHealthSnapshot();
	}).value;

	if (!data || data.cardCount === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No active cards yet.
			</div>
		);
	}

	const showBuckets = configValue(config, "showBuckets", true);
	const targetPct = configValue(config, "target", 90) as number;
	const retention = data.averageRetention;

	const barColor =
		retention >= targetPct
			? "var(--color-green)"
			: retention >= targetPct - 15
				? "var(--color-cyan)"
				: retention >= targetPct - 30
					? "var(--color-orange)"
					: "var(--color-red)";

	const handleBarClick = () => {
		plugin
			.openReviewViewWithFilters({ overdueOnly: true, ignoreDailyLimits: true })
			.catch(() => {});
	};

	const handleBucketClick = (bucketIdx: number) => {
		// Map bucket index to stability range for review filter
		// Buckets: 0=Strong (>90%), 1=High (75-90%), 2=Medium (50-75%), 3=Low (25-50%), 4=At risk (<25%)
		const ranges: { min: number; max: number }[] = [
			{ min: 50, max: 999 },
			{ min: 20, max: 50 },
			{ min: 5, max: 20 },
			{ min: 1, max: 5 },
			{ min: 0, max: 1 },
		];
		const range = ranges[bucketIdx];
		if (!range) return;

		plugin
			.openReviewViewWithFilters({
				stabilityRange: range,
				ignoreDailyLimits: true,
			})
			.catch(() => {});
	};

	const maxBucket = Math.max(1, ...data.distribution.map((b) => b.count));

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:text-sm">
			{/* Header + percentage */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">Memory Health</span>
				<span class="ep:font-semibold">{retention}%</span>
			</div>

			{/* Progress bar */}
			<Clickable onClick={handleBarClick} title="Review overdue cards">
				<div class="ep:h-3 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden ep:relative">
					<div
						class="ep:h-full ep:rounded-full ep:transition-all"
						style={{
							width: `${retention}%`,
							backgroundColor: barColor,
						}}
					/>
					{/* Target marker */}
					<div
						class="ep:absolute ep:top-0 ep:h-full ep:w-px ep:bg-obs-text-normal ep:opacity-40"
						style={{ left: `${targetPct}%` }}
					/>
				</div>
				<div class="ep:text-right ep:text-xs ep:text-obs-muted ep:mt-0.5">
					target: {targetPct}%
				</div>
			</Clickable>

			{/* Health buckets */}
			{showBuckets && data.distribution.length > 0 && (
				<div class="ep:flex ep:items-end ep:gap-2 ep:justify-between">
					{data.distribution.map((bucket, idx) => (
						<Clickable
							key={bucket.label}
							class="ep:flex ep:flex-col ep:items-center ep:gap-1 hover:ep:opacity-80 ep:flex-1"
							onClick={() => handleBucketClick(idx)}
							title={`Review ${bucket.label} cards`}
						>
							<span class="ep:text-xs ep:text-obs-muted">{bucket.label}</span>
							<span class="ep:text-xs ep:font-semibold">{bucket.count}</span>
							<div
								class="ep:w-full ep:rounded ep:min-h-[2px]"
								style={{
									height: `${Math.max(2, (bucket.count / maxBucket) * 24)}px`,
									backgroundColor: `var(${bucket.colorVar})`,
								}}
							/>
						</Clickable>
					))}
					<div class="ep:flex ep:flex-col ep:items-center ep:gap-1 ep:pl-2">
						<span class="ep:text-xs ep:text-obs-muted">&nbsp;</span>
						<span class="ep:text-xs ep:text-obs-muted">
							{data.cardCount} active
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
