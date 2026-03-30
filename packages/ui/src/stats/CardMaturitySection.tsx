import type { CardMaturityBreakdown } from "@true-recall/core";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS } from "./chart-theme";
import { useChart } from "./use-chart";
import { ChartCard } from "./ChartCard";

interface CardMaturitySectionProps {
	data: CardMaturityBreakdown;
}

export function CardMaturitySection({ data }: CardMaturitySectionProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useChart(canvasRef, (): ChartConfiguration<"doughnut"> | null => {
		const total = data.mature + data.young + data.new + data.suspended;
		if (total === 0) return null;
		return {
			type: "doughnut",
			data: {
				labels: ["Mature", "Young", "New", "Suspended"],
				datasets: [
					{
						data: [data.mature, data.young, data.new, data.suspended],
						backgroundColor: [
							CHART_COLORS.green(),
							CHART_COLORS.blue(),
							CHART_COLORS.orange(),
							CHART_COLORS.red(),
						],
						borderWidth: 0,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: "right",
						labels: {
							color: CHART_COLORS.normal(),
							padding: 8,
							font: { size: 11 },
						},
					},
				},
			},
		};
	}, [data]);

	const total = data.mature + data.young + data.new + data.suspended;

	if (total === 0) {
		return (
			<ChartCard title="Card Maturity" subtitle="Distribution by maturity">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No cards yet
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard title="Card Maturity" subtitle="Distribution by maturity">
			<div class="ep:h-48">
				<canvas ref={canvasRef} />
			</div>
		</ChartCard>
	);
}
