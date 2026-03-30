import {
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	type ChartConfiguration,
	type ChartTypeRegistry,
	DoughnutController,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Title,
	Tooltip,
} from "chart.js";
import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

Chart.register(
	ArcElement,
	BarController,
	BarElement,
	CategoryScale,
	DoughnutController,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Title,
	Tooltip,
);

/**
 * Manages Chart.js lifecycle: create → update → destroy.
 * Rebuilds chart when deps change or theme changes.
 */
export function useChart<T extends keyof ChartTypeRegistry>(
	canvasRef: RefObject<HTMLCanvasElement | null>,
	configFactory: () => ChartConfiguration<T> | null,
	deps: unknown[],
): void {
	const chartRef = useRef<Chart<T> | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const config = configFactory();
		if (!config) return;

		chartRef.current?.destroy();
		chartRef.current = new Chart(canvas, config);

		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deps are passed dynamically by the caller; static analysis cannot verify them
	}, deps);

	// Rebuild on Obsidian theme change (dark ↔ light toggles class on body)
	useEffect(() => {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "class"
				) {
					const canvas = canvasRef.current;
					if (!canvas || !chartRef.current) return;

					const config = configFactory();
					if (!config) return;

					chartRef.current.destroy();
					chartRef.current = new Chart(canvas, config);
				}
			}
		});

		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- configFactory is intentionally excluded; MutationObserver recreates chart using latest factory ref
	}, []);
}
