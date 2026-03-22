import { ChartLegend } from "@features/metrics/ui/simulator/components/ChartLegend";
import { GRADE_NAMES } from "@features/metrics/ui/simulator/constants";
import type {
	MetricType,
	SequenceSimulation,
} from "@features/metrics/ui/simulator/types";
import {
	getMetricData,
	getMetricLabel,
} from "@features/metrics/ui/simulator/utils/simulator-helpers";
import { Chart, type ChartConfiguration } from "chart.js";
import { useEffect, useRef } from "preact/hooks";

interface SimulatorChartProps {
	simulations: SequenceSimulation[];
	metricType: MetricType;
	useLogarithmic: boolean;
	useAnimation: boolean;
}

export function SimulatorChart({
	simulations,
	metricType,
	useLogarithmic,
	useAnimation,
}: SimulatorChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart | null>(null);

	useEffect(() => {
		if (!canvasRef.current) return;

		const maxReviews = Math.max(...simulations.map((s) => s.reviews.length), 1);

		const config: ChartConfiguration<"line"> = {
			type: "line",
			data: {
				labels: Array.from({ length: maxReviews }, (_, i) => i),
				datasets: simulations.map((sim) => ({
					label: sim.sequence,
					data: getMetricData(sim.reviews, metricType),
					borderColor: sim.color,
					backgroundColor: `${sim.color}40`,
					tension: 0.2,
					pointRadius: 5,
					pointHoverRadius: 8,
					pointBackgroundColor: sim.color,
				})),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: useAnimation ? { duration: 400 } : false,
				interaction: { intersect: false, mode: "index" },
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const sim = simulations[ctx.datasetIndex];
								const review = sim?.reviews[ctx.dataIndex];
								if (!review) return ctx.formattedValue;
								const gradeName = GRADE_NAMES[review.grade] || "N/A";
								const diffPct = (review.difficulty * 10).toFixed(0);
								return `${sim.sequence}: ${ctx.formattedValue} (${gradeName}, D: ${diffPct}%)`;
							},
						},
					},
				},
				scales: {
					x: {
						title: { display: true, text: "Review Number" },
						ticks: { stepSize: 1 },
					},
					y: {
						type: useLogarithmic ? "logarithmic" : "linear",
						beginAtZero: true,
						title: { display: true, text: getMetricLabel(metricType) },
					},
				},
			},
		};

		chartRef.current = new Chart(canvasRef.current, config);

		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!chartRef.current) return;

		const chart = chartRef.current;
		const maxReviews = Math.max(...simulations.map((s) => s.reviews.length), 1);

		chart.data.labels = Array.from({ length: maxReviews }, (_, i) => i);
		chart.data.datasets = simulations.map((sim) => ({
			label: sim.sequence,
			data: getMetricData(sim.reviews, metricType),
			borderColor: sim.color,
			backgroundColor: `${sim.color}40`,
			tension: 0.2,
			pointRadius: 5,
			pointHoverRadius: 8,
			pointBackgroundColor: sim.color,
		}));

		if (chart.options.scales?.y) {
			const yScale = chart.options.scales.y as {
				type?: string;
				title?: { display: boolean; text: string };
			};
			yScale.type = useLogarithmic ? "logarithmic" : "linear";
			yScale.title = { display: true, text: getMetricLabel(metricType) };
		}

		chart.options.animation = useAnimation ? { duration: 400 } : false;
		chart.update(useAnimation ? "default" : "none");
	}, [simulations, metricType, useLogarithmic, useAnimation]);

	return (
		<div class="ep:bg-obs-secondary ep:rounded-lg ep:p-4 ep:mb-4">
			<ChartLegend simulations={simulations} />
			<div class="ep:relative ep:h-87.5">
				<canvas ref={canvasRef} />
			</div>
		</div>
	);
}
