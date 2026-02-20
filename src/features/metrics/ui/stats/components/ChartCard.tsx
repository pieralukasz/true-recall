import type { Chart } from "chart.js";
import { useEffect, useRef } from "preact/hooks";
import { StatsCard } from "@features/metrics/ui/stats/components/StatsCard";

interface ChartCardProps {
	title: string;
	buildChart: (canvas: HTMLCanvasElement) => Chart;
	updateChart?: (chart: Chart) => void;
	deps: unknown[];
	emptyMessage?: string;
	isEmpty?: boolean;
	children?: preact.ComponentChildren;
	aboveCanvas?: preact.ComponentChildren;
}

export function ChartCard({
	title,
	buildChart,
	updateChart,
	deps,
	emptyMessage,
	isEmpty,
	children,
	aboveCanvas,
}: ChartCardProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart | null>(null);

	useEffect(() => {
		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (isEmpty) {
			chartRef.current?.destroy();
			chartRef.current = null;
			return;
		}
		if (!canvasRef.current) return;

		if (chartRef.current && updateChart) {
			updateChart(chartRef.current);
		} else {
			chartRef.current?.destroy();
			chartRef.current = buildChart(canvasRef.current);
		}
	}, deps);

	return (
		<StatsCard title={title}>
			{isEmpty ? (
				<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-52 ep:text-obs-muted ep:text-ui-small ep:italic">
					{emptyMessage || "No data available"}
				</div>
			) : (
				<>
					{aboveCanvas}
					<div class="ep:w-full ep:h-52 ep:relative">
						<canvas ref={canvasRef} class="true-recall-chart-fade-in" />
					</div>
					{children}
				</>
			)}
		</StatsCard>
	);
}
