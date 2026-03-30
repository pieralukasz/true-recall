import type { CardMaturityBreakdown } from "@true-recall/core/types";
import type { ChartConfiguration } from "chart.js";
import { useRef } from "preact/hooks";
import { CHART_COLORS } from "../helpers/chart-theme";
import { useChart } from "../hooks/use-chart";
import { ChartCard } from "./ChartCard";

interface CardMaturitySectionProps {
	data: CardMaturityBreakdown;
}

export function CardMaturitySection({ data }: CardMaturitySectionProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const total =
		data.new +
		data.learning +
		data.young +
		data.mature +
		data.suspended +
		data.buried;
	const maturePercent = total > 0 ? Math.round((data.mature / total) * 100) : 0;

	useChart(canvasRef, (): ChartConfiguration<"doughnut"> | null => {
		if (total === 0) return null;
		return {
			type: "doughnut",
			data: {
				labels: ["New", "Learning", "Young", "Mature", "Suspended", "Buried"],
				datasets: [
					{
						data: [
							data.new,
							data.learning,
							data.young,
							data.mature,
							data.suspended,
							data.buried,
						],
						backgroundColor: [
							CHART_COLORS.green(),
							CHART_COLORS.orange(),
							CHART_COLORS.blue(),
							CHART_COLORS.cyan(),
							CHART_COLORS.red(),
							CHART_COLORS.muted(),
						],
						borderWidth: 0,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: "60%",
				plugins: {
					legend: {
						position: "right",
						labels: {
							color: CHART_COLORS.normal(),
							boxWidth: 10,
							padding: 6,
							font: { size: 11 },
						},
					},
				},
			},
		};
	}, [data]);

	if (total === 0) {
		return (
			<ChartCard title="Card Maturity">
				<p class="ep:text-xs ep:text-obs-muted ep:py-8 ep:text-center">
					No cards yet
				</p>
			</ChartCard>
		);
	}

	return (
		<ChartCard
			title="Card Maturity"
			subtitle={`${maturePercent}% mature — ${total} total cards`}
		>
			<div class="ep:flex ep:items-center ep:gap-4">
				<div class="ep:h-40 ep:w-40 ep:shrink-0">
					<canvas ref={canvasRef} />
				</div>
				<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:text-xs">
					<MaturityRow label="New" count={data.new} color="ep:text-obs-green" />
					<MaturityRow
						label="Learning"
						count={data.learning}
						color="ep:text-obs-orange"
					/>
					<MaturityRow
						label="Young"
						count={data.young}
						color="ep:text-obs-blue"
					/>
					<MaturityRow
						label="Mature"
						count={data.mature}
						color="ep:text-obs-cyan"
					/>
					<MaturityRow
						label="Suspended"
						count={data.suspended}
						color="ep:text-obs-error"
					/>
					<MaturityRow
						label="Buried"
						count={data.buried}
						color="ep:text-obs-muted"
					/>
				</div>
			</div>
		</ChartCard>
	);
}

function MaturityRow({
	label,
	count,
	color,
}: {
	label: string;
	count: number;
	color: string;
}) {
	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
			<span class={`${color} ep:font-medium`}>{label}</span>
			<span class="ep:text-obs-muted">{count}</span>
		</div>
	);
}
