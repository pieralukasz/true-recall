import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { ChartCard } from "@features/metrics/ui/stats/components/ChartCard";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import type { CollectionHealthSnapshot } from "@shared/types";
import {
	getThemeColor,
	getThemeColorWithAlpha,
} from "@shared/ui/utils/theme-colors";
import { Chart } from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

function healthColor(pct: number): string {
	if (pct >= 90) return "--color-green";
	if (pct >= 75) return "--color-cyan";
	if (pct >= 60) return "--color-orange";
	return "--color-red";
}

export function CollectionHealthCard({
	statsCalculator,
}: {
	statsCalculator: StatsCalculatorService;
}) {
	const [snapshot, setSnapshot] = useState<CollectionHealthSnapshot | null>(
		null,
	);

	useEffect(() => {
		try {
			setSnapshot(statsCalculator.getCollectionHealthSnapshot());
		} catch (err) {
			console.error("Error computing collection health:", err);
			setSnapshot(null);
		}
	}, [statsCalculator]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			if (!snapshot) throw new Error("No snapshot");
			return new Chart(canvas, {
				type: "doughnut",
				data: {
					labels: snapshot.distribution.map((b) => b.label),
					datasets: [
						{
							data: snapshot.distribution.map((b) => b.count),
							backgroundColor: snapshot.distribution.map((b) =>
								getThemeColorWithAlpha(b.colorVar, 0.75),
							),
							borderColor: snapshot.distribution.map((b) =>
								getThemeColor(b.colorVar),
							),
							borderWidth: 1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: "60%",
					plugins: {
						legend: {
							display: true,
							position: "right",
							labels: { boxWidth: 12, font: { size: 11 } },
						},
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const total = snapshot.cardCount;
									const pct =
										total > 0
											? Math.round(((ctx.raw as number) / total) * 100)
											: 0;
									return ` ${ctx.raw} cards (${pct}%)`;
								},
							},
						},
					},
				},
			});
		},
		[snapshot],
	);

	const centerLabel = useMemo(() => {
		if (!snapshot || snapshot.cardCount === 0) return null;
		const color = healthColor(snapshot.averageRetention);
		return (
			<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:mt-2 ep:mb-1">
				<span
					class="ep:text-3xl ep:font-bold ep:tabular-nums"
					style={{ color: `var(${color})` }}
				>
					{snapshot.averageRetention}%
				</span>
				<span class="ep:text-ui-small ep:text-obs-muted">
					avg. predicted retention
				</span>
				<span class="ep:text-ui-smaller ep:text-obs-faint ep:mt-0.5">
					{snapshot.cardCount.toLocaleString()} active cards
				</span>
			</div>
		);
	}, [snapshot]);

	if (!snapshot || snapshot.cardCount === 0) {
		return (
			<StatsCard title="Collection health">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					Review some cards to see collection health
				</div>
			</StatsCard>
		);
	}

	return (
		<ChartCard
			title="Collection health"
			buildChart={buildChart}
			deps={[snapshot]}
			isEmpty={snapshot.cardCount === 0}
			emptyMessage="Review some cards to see collection health"
		>
			{centerLabel}
		</ChartCard>
	);
}
