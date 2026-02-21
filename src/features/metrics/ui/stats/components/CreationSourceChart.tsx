import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { ChartCard } from "@features/metrics/ui/stats/components/ChartCard";
import { SummaryList } from "@features/metrics/ui/stats/components/SummaryList";
import type { CreationSourceStats } from "@shared/types";
import {
	getThemeColor,
	getThemeColorWithAlpha,
} from "@shared/ui/utils/theme-colors";
import { Chart } from "chart.js";
import { useCallback, useEffect, useState } from "preact/hooks";

const SOURCE_CONFIG: Record<
	string,
	{ label: string; color: string }
> = {
	manual: { label: "Manual", color: "--color-blue" },
	ai: { label: "AI", color: "--color-purple" },
	anki_import: { label: "Anki import", color: "--color-orange" },
};

function getSourceConfig(source: string): { label: string; color: string } {
	return (
		SOURCE_CONFIG[source] ?? { label: source, color: "--color-muted" }
	);
}

function retentionLabel(rate: number | null): string {
	return rate !== null ? `${rate}%` : "—";
}

export function CreationSourceChart({
	statsCalculator,
}: {
	statsCalculator: StatsCalculatorService;
}) {
	const [data, setData] = useState<CreationSourceStats[]>([]);

	useEffect(() => {
		try {
			const rows = statsCalculator.getCreationSourcePerformance();
			setData(rows);
		} catch (err) {
			console.error("Error fetching creation source stats:", err);
			setData([]);
		}
	}, [statsCalculator]);

	// Only render when there are 2+ distinct sources
	const hasMixedSources = data.length >= 2;

	const summary = hasMixedSources
		? data.map((row) => {
				const cfg = getSourceConfig(row.source);
				return `${cfg.label}: ${row.cardCount} cards · retention ${retentionLabel(row.retentionRate)} · avg lapses ${row.avgLapses.toFixed(1)}`;
			})
		: [];

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const labels = data.map((r) => getSourceConfig(r.source).label);
			const colors = data.map((r) => getThemeColor(getSourceConfig(r.source).color));
			const alphaBg = data.map((r) =>
				getThemeColorWithAlpha(getSourceConfig(r.source).color, 0.7),
			);

			return new Chart(canvas, {
				type: "bar",
				data: {
					labels,
					datasets: [
						{
							label: "Cards",
							data: data.map((r) => r.cardCount),
							backgroundColor: alphaBg,
							borderColor: colors,
							borderWidth: 1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								afterBody: (items) => {
									const row = data[items[0]?.dataIndex ?? 0];
									if (!row) return [];
									return [
										`Retention: ${retentionLabel(row.retentionRate)}`,
										`Avg lapses: ${row.avgLapses.toFixed(1)}`,
									];
								},
							},
						},
					},
					scales: {
						y: { beginAtZero: true, ticks: { precision: 0 } },
						x: { ticks: { maxRotation: 0 } },
					},
				},
			});
		},
		[data],
	);

	if (!hasMixedSources) {
		return null;
	}

	return (
		<ChartCard
			title="Cards by source"
			buildChart={buildChart}
			deps={[data]}
			isEmpty={data.length === 0}
			emptyMessage="No card data available"
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}
