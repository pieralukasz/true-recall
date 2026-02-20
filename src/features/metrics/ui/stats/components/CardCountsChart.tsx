import { Chart } from "chart.js";
import { useEffect, useRef, useState } from "preact/hooks";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import type {
	CardMaturityBreakdown,
	FSRSFlashcardItem,
} from "@shared/types";
import { getThemeColor } from "@shared/ui/utils/theme-colors";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";

export function CardCountsChart({
	statsCalculator,
	onCategoryClick,
}: {
	statsCalculator: StatsCalculatorService;
	onCategoryClick: (
		category: keyof CardMaturityBreakdown,
		label: string,
		cards: FSRSFlashcardItem[],
	) => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart | null>(null);
	const [breakdown, setBreakdown] = useState<CardMaturityBreakdown | null>(
		null,
	);
	const [total, setTotal] = useState(0);

	useEffect(() => {
		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		try {
			const bd = statsCalculator.getCardMaturityBreakdown();
			const activeTotal = bd.new + bd.learning + bd.young + bd.mature;
			const t = activeTotal + bd.suspended + bd.buried;
			setBreakdown(bd);
			setTotal(t);
		} catch (err) {
			console.error("Error refreshing card counts chart:", err);
			setBreakdown(null);
		}
	}, [statsCalculator]);

	useEffect(() => {
		if (!breakdown || total === 0 || !canvasRef.current) return;

		chartRef.current?.destroy();

		const colors = {
			new: getThemeColor("--color-green"),
			learning: getThemeColor("--color-orange"),
			young: getThemeColor("--color-blue"),
			mature: getThemeColor("--color-purple"),
			suspended: getThemeColor("--text-faint"),
			buried: getThemeColor("--text-muted"),
		};

		const chartData: number[] = [
			breakdown.new,
			breakdown.learning,
			breakdown.young,
			breakdown.mature,
		];
		const chartLabels: string[] = ["New", "Learning", "Young", "Mature"];
		const chartColors: string[] = [
			colors.new,
			colors.learning,
			colors.young,
			colors.mature,
		];

		if (breakdown.suspended > 0) {
			chartData.push(breakdown.suspended);
			chartLabels.push("Suspended");
			chartColors.push(colors.suspended);
		}
		if (breakdown.buried > 0) {
			chartData.push(breakdown.buried);
			chartLabels.push("Buried");
			chartColors.push(colors.buried);
		}

		chartRef.current = new Chart(canvasRef.current, {
			type: "doughnut",
			data: {
				labels: chartLabels,
				datasets: [{ data: chartData, backgroundColor: chartColors }],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
			},
		});
	}, [breakdown, total]);

	if (!breakdown || total === 0) {
		return (
			<StatsCard title="Card counts">
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					No cards found
				</div>
			</StatsCard>
		);
	}

	const colors = {
		new: getThemeColor("--color-green"),
		learning: getThemeColor("--color-orange"),
		young: getThemeColor("--color-blue"),
		mature: getThemeColor("--color-purple"),
		suspended: getThemeColor("--text-faint"),
		buried: getThemeColor("--text-muted"),
	};

	const legendItems: {
		label: string;
		value: number;
		color: string;
		category: keyof CardMaturityBreakdown;
	}[] = [
		{ label: "New", value: breakdown.new, color: colors.new, category: "new" },
		{
			label: "Learning",
			value: breakdown.learning,
			color: colors.learning,
			category: "learning",
		},
		{
			label: "Young",
			value: breakdown.young,
			color: colors.young,
			category: "young",
		},
		{
			label: "Mature",
			value: breakdown.mature,
			color: colors.mature,
			category: "mature",
		},
	];

	if (breakdown.suspended > 0) {
		legendItems.push({
			label: "Suspended",
			value: breakdown.suspended,
			color: colors.suspended,
			category: "suspended",
		});
	}
	if (breakdown.buried > 0) {
		legendItems.push({
			label: "Buried",
			value: breakdown.buried,
			color: colors.buried,
			category: "buried",
		});
	}

	return (
		<StatsCard title="Card counts">
			<div class="ep:flex ep:gap-8 ep:items-center ep:justify-center">
				{/* Chart */}
				<div class="ep:w-45 ep:h-45 ep:relative ep:shrink-0">
					<canvas
						ref={canvasRef}
						class="ep:w-full! ep:h-full! true-recall-chart-fade-in"
					/>
				</div>

				{/* Legend */}
				<div class="ep:flex ep:flex-col ep:gap-2">
					{legendItems.map((item) => {
						const percentage = Math.round((item.value / total) * 100);
						return (
							<button
								type="button"
								key={item.category}
								class="ep:flex ep:items-center ep:gap-3 ep:py-2 ep:px-3 ep:rounded-md ep:transition-all ep:cursor-pointer ep:hover:bg-obs-primary ep:hover:-translate-x-0.5 ep:bg-transparent ep:border-none ep:font-inherit ep:text-left ep:w-full"
								onClick={() => {
									if (item.value > 0) {
										const cards = statsCalculator.getCardsByCategory(
											item.category,
										);
										onCategoryClick(item.category, item.label, cards);
									}
								}}
							>
								<div
									class="ep:w-4 ep:h-4 ep:rounded-sm ep:shrink-0 ep-dynamic-bg"
									style={
										{ "--ep-dynamic-color": item.color } as Record<
											string,
											string
										>
									}
								/>
								<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
									{item.label}
								</span>
								<span class="ep:ml-auto ep:text-ui-small ep:font-semibold ep:text-obs-muted">
									{item.value} ({percentage}%)
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</StatsCard>
	);
}
