import type { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { ChartCard } from "@features/metrics/ui/stats/components/ChartCard";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";
import { SummaryList } from "@features/metrics/ui/stats/components/SummaryList";
import {
	formatDateForDisplay,
	formatDateLabel,
	getMaxTicksForRange,
} from "@features/metrics/ui/stats/utils/chart-helpers";
import type { RatingDistributionEntry, StatsTimeRange } from "@shared/types";
import {
	getThemeColor,
	getThemeColorWithAlpha,
} from "@shared/ui/utils/theme-colors";
import { Chart, type ChartDataset } from "chart.js";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

type RatingKey = "again" | "hard" | "good" | "easy";

const RATING_CONFIG: {
	key: RatingKey;
	label: string;
	color: string;
}[] = [
	{ key: "again", label: "Again", color: "--color-red" },
	{ key: "hard", label: "Hard", color: "--color-orange" },
	{ key: "good", label: "Good", color: "--color-green" },
	{ key: "easy", label: "Easy", color: "--color-blue" },
];

export function RatingDistributionChart({
	statsCalculator,
	currentRange,
}: {
	statsCalculator: StatsCalculatorService;
	currentRange: StatsTimeRange;
}) {
	const [data, setData] = useState<RatingDistributionEntry[]>([]);
	const [visibility, setVisibility] = useState<Record<RatingKey, boolean>>({
		again: true,
		hard: true,
		good: true,
		easy: true,
	});

	useEffect(() => {
		if (currentRange === "backlog") {
			setData([]);
			return;
		}
		try {
			setData(statsCalculator.getRatingDistributionHistory(currentRange));
		} catch (err) {
			console.error("Error fetching rating distribution:", err);
			setData([]);
		}
	}, [statsCalculator, currentRange]);

	const toggleVisibility = useCallback((key: RatingKey) => {
		setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
	}, []);

	const summary = useMemo(() => {
		if (data.length === 0) return [];
		const totals = { again: 0, hard: 0, good: 0, easy: 0 };
		for (const d of data) {
			totals.again += d.again;
			totals.hard += d.hard;
			totals.good += d.good;
			totals.easy += d.easy;
		}
		const total = totals.again + totals.hard + totals.good + totals.easy;
		if (total === 0) return [];

		const againPct = Math.round((totals.again / total) * 100);
		const successPct = Math.round(((totals.good + totals.easy) / total) * 100);

		return [
			`Total reviews: ${total.toLocaleString()}`,
			`Success rate (Good+Easy): ${successPct}%`,
			`Again rate: ${againPct}%`,
		];
	}, [data]);

	const buildChart = useCallback(
		(canvas: HTMLCanvasElement) => {
			const maxTicks = getMaxTicksForRange(currentRange);
			const datasets: ChartDataset<"bar", number[]>[] = RATING_CONFIG.filter(
				(r) => visibility[r.key],
			).map((r) => ({
				label: r.label,
				data: data.map((d) => d[r.key]),
				backgroundColor: getThemeColorWithAlpha(r.color, 0.75),
				borderColor: getThemeColor(r.color),
				borderWidth: 1,
				stack: "ratings",
			}));

			return new Chart(canvas, {
				type: "bar",
				data: {
					labels: data.map((d) => formatDateLabel(d.date)),
					datasets,
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								title: (items) => {
									if (items.length > 0)
										return formatDateForDisplay(
											data[items[0]?.dataIndex ?? 0]?.date ?? "",
										);
									return "";
								},
								afterBody: (items) => {
									const entry = data[items[0]?.dataIndex ?? 0];
									if (!entry) return [];
									const pct = (n: number) =>
										`${Math.round((n / entry.total) * 100)}%`;
									return [
										`Again: ${entry.again} (${pct(entry.again)})`,
										`Hard: ${entry.hard} (${pct(entry.hard)})`,
										`Good: ${entry.good} (${pct(entry.good)})`,
										`Easy: ${entry.easy} (${pct(entry.easy)})`,
										`Total: ${entry.total}`,
									];
								},
								label: () => "",
							},
						},
					},
					scales: {
						y: { beginAtZero: true, stacked: true, ticks: { precision: 0 } },
						x: {
							stacked: true,
							ticks: {
								maxRotation: 45,
								minRotation: 45,
								maxTicksLimit: maxTicks,
							},
						},
					},
				},
			});
		},
		[data, currentRange, visibility],
	);

	if (currentRange === "backlog") {
		return (
			<StatsCard title="Rating breakdown">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					Select a time range to see rating breakdown
				</div>
			</StatsCard>
		);
	}

	const controls = (
		<div class="ep:flex ep:flex-wrap ep:gap-4 ep:justify-center ep:mb-3 ep:pb-3 ep:border-b ep:border-obs-border">
			{RATING_CONFIG.map(({ key, label, color }) => {
				const resolvedColor = getThemeColorWithAlpha(color, 0.9);
				return (
					<button
						type="button"
						key={key}
						class="ep:flex ep:items-center ep:gap-1.5 ep:cursor-pointer ep:select-none ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit"
						onClick={() => toggleVisibility(key)}
					>
						<input
							id={`rating-toggle-${key}`}
							type="checkbox"
							class="ep:cursor-pointer ep-dynamic-accent"
							checked={visibility[key]}
							style={
								{ "--ep-dynamic-color": resolvedColor } as Record<
									string,
									string
								>
							}
							onChange={() => toggleVisibility(key)}
						/>
						<label
							htmlFor={`rating-toggle-${key}`}
							class="ep:text-ui-small ep:cursor-pointer ep-dynamic-color"
							style={
								{
									"--ep-dynamic-color": visibility[key]
										? resolvedColor
										: "var(--text-muted)",
								} as Record<string, string>
							}
						>
							{label}
						</label>
					</button>
				);
			})}
		</div>
	);

	return (
		<ChartCard
			title="Rating breakdown"
			buildChart={buildChart}
			deps={[data, currentRange, visibility]}
			isEmpty={data.length === 0}
			emptyMessage="No review data available"
			aboveCanvas={controls}
		>
			<SummaryList items={summary} />
		</ChartCard>
	);
}
