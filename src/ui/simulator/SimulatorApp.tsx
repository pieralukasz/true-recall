import { useSignal } from "@preact/signals";
import { Chart, type ChartConfiguration } from "chart.js";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { FSRSSimulatorService } from "../../services/core/fsrs-simulator.service";
import type { SimulatorApi } from "../../state/store";
import { usePlugin } from "../preact";
import { ALL_SLIDERS, GRADE_NAMES } from "./constants";
import type {
	MetricType,
	SequenceReview,
	SequenceSimulation,
	SliderConfig,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────

function getMetricData(
	reviews: SequenceReview[],
	metricType: MetricType,
): number[] {
	return reviews.map((r) => {
		switch (metricType) {
			case "interval":
				return r.interval;
			case "stability":
				return r.stability;
			case "difficulty":
				return r.difficulty;
			case "cumulative":
				return r.cumulativeInterval;
			default:
				return r.interval;
		}
	});
}

function getMetricLabel(metricType: MetricType): string {
	switch (metricType) {
		case "interval":
			return "Interval (days)";
		case "stability":
			return "Stability";
		case "difficulty":
			return "Difficulty (0-10)";
		case "cumulative":
			return "Cumulative Interval (days)";
		default:
			return "Value";
	}
}

function formatSliderValue(value: number, config: SliderConfig): string {
	const decimals = config.step < 0.01 ? 4 : config.step < 0.1 ? 2 : 1;
	return value.toFixed(decimals);
}

const BUTTON_CLS = [
	"ep:px-3 ep:py-1.5",
	"ep:bg-obs-secondary ep:text-obs-normal",
	"ep:border ep:border-obs-border ep:rounded-md",
	"ep:cursor-pointer ep:text-ui-smaller",
	"hover:ep:bg-obs-modifier-hover",
].join(" ");

// ─── SimulatorChart ─────────────────────────────────────────────────

interface SimulatorChartProps {
	simulations: SequenceSimulation[];
	metricType: MetricType;
	useLogarithmic: boolean;
	useAnimation: boolean;
}

function SimulatorChart({
	simulations,
	metricType,
	useLogarithmic,
	useAnimation,
}: SimulatorChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart | null>(null);

	// Create chart once
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

	// Update chart data when props change
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
			<div class="ep:relative ep:h-[350px]">
				<canvas ref={canvasRef} />
			</div>
		</div>
	);
}

// ─── ChartLegend ────────────────────────────────────────────────────

function ChartLegend({ simulations }: { simulations: SequenceSimulation[] }) {
	return (
		<div class="ep:flex ep:flex-wrap ep:gap-3 ep:mb-4 ep:justify-end">
			{simulations.map((sim) => (
				<div key={sim.sequence} class="ep:flex ep:items-center ep:gap-1.5">
					<div
						class="ep:w-4 ep:h-4 ep:rounded-sm ep-dynamic-bg"
						style={
							{ "--ep-dynamic-color": sim.color } as Record<string, string>
						}
					/>
					<span class="ep:text-ui-small ep:text-obs-muted">{sim.sequence}</span>
				</div>
			))}
		</div>
	);
}

// ─── SimulatorControls ──────────────────────────────────────────────

interface SimulatorControlsProps {
	simulator: SimulatorApi;
	onSequencesChange: () => void;
	onMetricChange: () => void;
	onOptionsChange: () => void;
}

function SimulatorControls({
	simulator,
	onSequencesChange,
	onMetricChange,
	onOptionsChange,
}: SimulatorControlsProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleReset = useCallback(() => {
		simulator.resetSequences();
		if (textareaRef.current) {
			textareaRef.current.value = simulator.getSequences().join("\n");
		}
		onSequencesChange();
	}, [simulator, onSequencesChange]);

	const handleTextareaInput = useCallback(() => {
		if (!textareaRef.current) return;
		const lines = textareaRef.current.value
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && /^[1-4]+$/.test(line));

		if (lines.length > 0) {
			simulator.setSequences(lines);
			onSequencesChange();
		}
	}, [simulator, onSequencesChange]);

	const currentMetric = simulator.getMetricType();
	const currentAnimation = simulator.getUseAnimation();
	const currentLogarithmic = simulator.getUseLogarithmic();

	const metrics: { value: MetricType; label: string }[] = [
		{ value: "interval", label: "Interval" },
		{ value: "stability", label: "Stability" },
		{ value: "difficulty", label: "Difficulty" },
		{ value: "cumulative", label: "CumulativeInterval" },
	];

	return (
		<div class="ep:bg-obs-secondary ep:rounded-lg ep:p-4">
			<button
				type="button"
				class={[
					"ep:w-full ep:mb-3 ep:px-3 ep:py-2",
					"ep:bg-obs-primary ep:text-obs-normal",
					"ep:border ep:border-obs-border ep:rounded-lg",
					"ep:cursor-pointer ep:text-ui-small",
					"hover:ep:bg-obs-modifier-hover",
				].join(" ")}
				onClick={handleReset}
			>
				Reset reviews
			</button>

			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-2">
				1=Again, 2=Hard, 3=Good, 4=Easy
			</div>

			<textarea
				ref={textareaRef}
				class={[
					"ep:w-full ep:h-[150px] ep:mb-4",
					"ep:bg-obs-primary ep:text-obs-normal",
					"ep:border ep:border-obs-border ep:rounded-lg",
					"ep:p-2 ep:text-ui-small ep:font-mono",
					"ep:resize-none",
				].join(" ")}
				value={simulator.getSequences().join("\n")}
				onInput={handleTextareaInput}
			/>

			{/* Metric type radio buttons */}
			<div class="ep:mb-4">
				{metrics.map((metric) => (
					<label
						key={metric.value}
						class="ep:flex ep:items-center ep:gap-2 ep:mb-1 ep:cursor-pointer ep:text-ui-small"
					>
						<input
							type="radio"
							class="ep:cursor-pointer"
							name="metric-type"
							value={metric.value}
							checked={metric.value === currentMetric}
							onChange={() => {
								simulator.setMetricType(metric.value);
								onMetricChange();
							}}
						/>
						<span class="ep:text-obs-normal">{metric.label}</span>
					</label>
				))}
			</div>

			{/* Option checkboxes */}
			<div>
				<label class="ep:flex ep:items-center ep:gap-2 ep:mb-1 ep:cursor-pointer ep:text-ui-small">
					<input
						type="checkbox"
						class="ep:cursor-pointer"
						checked={currentAnimation}
						onChange={(e) => {
							simulator.setUseAnimation((e.target as HTMLInputElement).checked);
							onOptionsChange();
						}}
					/>
					<span class="ep:text-obs-normal">Animation</span>
				</label>
				<label class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-small">
					<input
						type="checkbox"
						class="ep:cursor-pointer"
						checked={currentLogarithmic}
						onChange={(e) => {
							simulator.setUseLogarithmic(
								(e.target as HTMLInputElement).checked,
							);
							onOptionsChange();
						}}
					/>
					<span class="ep:text-obs-normal">Logarithmic</span>
				</label>
			</div>
		</div>
	);
}

// ─── SimulatorSliderRow ─────────────────────────────────────────────

interface SliderRowProps {
	config: SliderConfig;
	value: number;
	onValueChange: (index: number, value: number) => void;
}

function SimulatorSliderRow({ config, value, onValueChange }: SliderRowProps) {
	const rangeRef = useRef<HTMLInputElement>(null);
	const numberRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sync inputs when value changes externally (undo/redo/reset)
	useEffect(() => {
		if (rangeRef.current) rangeRef.current.value = String(value);
		if (numberRef.current)
			numberRef.current.value = formatSliderValue(value, config);
	}, [value, config]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const debouncedUpdate = useCallback(
		(newValue: number) => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				onValueChange(config.index, newValue);
				debounceRef.current = null;
			}, 150);
		},
		[config.index, onValueChange],
	);

	const handleRangeInput = useCallback(
		(e: Event) => {
			const val = parseFloat((e.target as HTMLInputElement).value);
			if (numberRef.current)
				numberRef.current.value = formatSliderValue(val, config);
			debouncedUpdate(val);
		},
		[config, debouncedUpdate],
	);

	const handleNumberChange = useCallback(() => {
		if (!numberRef.current) return;
		let val = parseFloat(numberRef.current.value);
		if (Number.isNaN(val)) val = config.defaultValue;
		val = Math.max(config.min, Math.min(config.max, val));
		numberRef.current.value = formatSliderValue(val, config);
		if (rangeRef.current) rangeRef.current.value = String(val);
		debouncedUpdate(val);
	}, [config, debouncedUpdate]);

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === "Enter") (e.target as HTMLInputElement).blur();
	}, []);

	return (
		<div class="ep:flex ep:items-center ep:gap-2">
			<div
				class="ep:w-[200px] ep:text-ui-smaller ep:text-obs-muted ep:truncate"
				title={config.description}
			>
				{config.name}
			</div>
			<input
				ref={numberRef}
				type="text"
				class={[
					"ep:w-[70px] ep:px-2 ep:py-1",
					"ep:bg-obs-primary ep:text-obs-normal",
					"ep:border ep:border-obs-border ep:rounded-lg",
					"ep:text-ui-smaller ep:text-center",
				].join(" ")}
				value={formatSliderValue(value, config)}
				onChange={handleNumberChange}
				onKeyDown={handleKeyDown}
			/>
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:w-[40px] ep:text-right">
				{config.min}
			</div>
			<input
				ref={rangeRef}
				type="range"
				class="ep:flex-1 ep:cursor-pointer ep:h-1 ep:simulator-slider"
				min={config.min}
				max={config.max}
				step={config.step}
				value={value}
				onInput={handleRangeInput}
			/>
			<div class="ep:text-ui-smaller ep:text-obs-muted ep:w-[40px]">
				{config.max}
			</div>
		</div>
	);
}

// ─── SimulatorSliders ───────────────────────────────────────────────

interface SimulatorSlidersProps {
	simulator: SimulatorApi;
	onParameterChange: () => void;
	/** Bumped to force re-read of slider values (undo/redo/reset) */
	version: number;
}

function SimulatorSliders({
	simulator,
	onParameterChange,
	version,
}: SimulatorSlidersProps) {
	const handleValueChange = useCallback(
		(index: number, value: number) => {
			if (index === -1) {
				simulator.setDesiredRetention(value);
			} else {
				simulator.setParameter(index, value);
			}
			onParameterChange();
		},
		[simulator, onParameterChange],
	);

	// Read current values, keyed off version to react to undo/redo/reset
	const getSliderValue = useCallback(
		(index: number): number => {
			if (index === -1) return simulator.getDesiredRetention();
			return simulator.getParameters()[index] ?? 0;
		},
		[simulator, version],
	);

	return (
		<div class="ep:bg-obs-secondary ep:rounded-lg ep:p-4 ep:mb-4">
			<div class="ep:grid ep:grid-cols-1 md:ep:grid-cols-2 lg:ep:grid-cols-3 ep:gap-3">
				{ALL_SLIDERS.map((config) => (
					<SimulatorSliderRow
						key={config.index}
						config={config}
						value={getSliderValue(config.index)}
						onValueChange={handleValueChange}
					/>
				))}
			</div>
		</div>
	);
}

// ─── SimulatorResultsTable ──────────────────────────────────────────

function SimulatorResultsTable({
	simulations,
}: {
	simulations: SequenceSimulation[];
}) {
	const maxReviews = Math.max(...simulations.map((s) => s.reviews.length), 1);

	const headerCellCls = [
		"ep:py-2 ep:px-3",
		"ep:text-left ep:font-semibold",
		"ep:text-obs-muted ep:text-ui-smaller ep:uppercase",
		"ep:border-b ep:border-obs-border",
	].join(" ");

	const bodyCellCls = "ep:py-2 ep:px-3 ep:text-obs-normal";

	return (
		<div class="ep:bg-obs-secondary ep:rounded-lg ep:p-4">
			<table class="ep:w-full ep:text-ui-small">
				<thead>
					<tr>
						<th class={headerCellCls}>Grade</th>
						{Array.from({ length: maxReviews }, (_, i) => (
							<th key={i} class={headerCellCls}>
								Ivl-{i}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{simulations.map((sim) => (
						<tr
							key={sim.sequence}
							class="ep:border-b ep:border-obs-border last:ep:border-b-0"
						>
							<td class={bodyCellCls}>
								<div class="ep:flex ep:items-center ep:gap-2">
									<div
										class="ep:w-3 ep:h-3 ep:rounded-full ep:flex-shrink-0 ep-dynamic-bg"
										style={
											{ "--ep-dynamic-color": sim.color } as Record<
												string,
												string
											>
										}
									/>
									<span class="ep:font-mono">{sim.sequence}</span>
								</div>
							</td>
							{Array.from({ length: maxReviews }, (_, i) => {
								const review = sim.reviews[i];
								const interval = review ? Math.round(review.interval) : "-";
								return (
									<td
										key={i}
										class={`${bodyCellCls} ep:text-center ep:font-mono`}
									>
										{interval}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// ─── ParametersBar ──────────────────────────────────────────────────

interface ParametersBarProps {
	simulator: SimulatorApi;
	parametersString: string;
	canUndo: boolean;
	canRedo: boolean;
	onReset: () => void;
	onUndo: () => void;
	onRedo: () => void;
}

function ParametersBar({
	parametersString,
	canUndo,
	canRedo,
	onReset,
	onUndo,
	onRedo,
}: ParametersBarProps) {
	return (
		<div class="ep:mb-4">
			<div
				class={[
					"ep:text-ui-smaller ep:text-obs-muted",
					"ep:bg-obs-secondary ep:p-2 ep:rounded-lg",
					"ep:font-mono ep:mb-2",
				].join(" ")}
			>
				{parametersString}
			</div>
			<div class="ep:flex ep:gap-2 ep:items-center">
				<button type="button" class={BUTTON_CLS} onClick={onReset}>
					Reset parameters
				</button>
				<button
					type="button"
					class={`${BUTTON_CLS}${!canUndo ? " ep:opacity-50" : ""}`}
					disabled={!canUndo}
					onClick={onUndo}
				>
					Undo
				</button>
				<button
					type="button"
					class={`${BUTTON_CLS}${!canRedo ? " ep:opacity-50" : ""}`}
					disabled={!canRedo}
					onClick={onRedo}
				>
					Redo
				</button>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">1 / 1</div>
			</div>
		</div>
	);
}

// ─── SimulatorApp (root) ────────────────────────────────────────────

export function SimulatorApp() {
	const plugin = usePlugin();
	const simulator = plugin.store?.getState().simulator;
	const simulatorService = useMemo(() => new FSRSSimulatorService(), []);

	// Reactive signals to drive re-renders
	const simulations = useSignal<SequenceSimulation[]>([]);
	const parametersString = useSignal("");
	const canUndoSig = useSignal(false);
	const canRedoSig = useSignal(false);
	// Bumped after undo/redo/reset to force slider re-read
	const sliderVersion = useSignal(0);

	const runSimulation = useCallback(() => {
		if (!simulator) return;
		const sequences = simulator.getSequences();
		const parameters = simulator.getParameters();
		const retention = simulator.getDesiredRetention();
		const results = simulatorService.simulate(sequences, parameters, retention);
		simulator.setSimulations(results);
		simulations.value = results;
		parametersString.value = simulator.getParametersString();
		canUndoSig.value = simulator.canUndo();
		canRedoSig.value = simulator.canRedo();
	}, [
		simulator,
		simulatorService,
		simulations,
		parametersString,
		canUndoSig,
		canRedoSig,
	]);

	// Debounced simulation trigger
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scheduleUpdate = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			runSimulation();
			timerRef.current = null;
		}, 100);
	}, [runSimulation]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	// Chart-only re-render: just read fresh simulations without re-running
	const refreshChart = useCallback(() => {
		if (!simulator) return;
		simulations.value = [...simulator.getSimulations()];
	}, [simulator, simulations]);

	// Initial simulation on mount
	useEffect(() => {
		runSimulation();
	}, [runSimulation]);

	// Parameters bar handlers
	const handleResetParams = useCallback(() => {
		if (!simulator) return;
		simulator.resetParameters();
		sliderVersion.value = sliderVersion.peek() + 1;
		scheduleUpdate();
	}, [simulator, sliderVersion, scheduleUpdate]);

	const handleUndo = useCallback(() => {
		if (!simulator) return;
		simulator.undo();
		sliderVersion.value = sliderVersion.peek() + 1;
		scheduleUpdate();
	}, [simulator, sliderVersion, scheduleUpdate]);

	const handleRedo = useCallback(() => {
		if (!simulator) return;
		simulator.redo();
		sliderVersion.value = sliderVersion.peek() + 1;
		scheduleUpdate();
	}, [simulator, sliderVersion, scheduleUpdate]);

	if (!simulator) return null;

	return (
		<div class="ep:p-2 ep:max-w-[1400px] ep:mx-auto">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:mb-4">
				{/* eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym */}
				<h2 class="ep:text-xl ep:font-bold ep:text-obs-normal ep:m-0">
					FSRS 6
				</h2>
			</div>

			{/* Main content: left panel + chart area */}
			<div class="ep:flex ep:gap-4 ep:mb-4">
				<div class="ep:w-[220px] ep:flex-shrink-0">
					<SimulatorControls
						simulator={simulator}
						onSequencesChange={scheduleUpdate}
						onMetricChange={refreshChart}
						onOptionsChange={refreshChart}
					/>
				</div>
				<div class="ep:flex-1 ep:min-w-0">
					<SimulatorChart
						simulations={simulations.value}
						metricType={simulator.getMetricType()}
						useLogarithmic={simulator.getUseLogarithmic()}
						useAnimation={simulator.getUseAnimation()}
					/>
				</div>
			</div>

			{/* Parameters bar */}
			<ParametersBar
				simulator={simulator}
				parametersString={parametersString.value}
				canUndo={canUndoSig.value}
				canRedo={canRedoSig.value}
				onReset={handleResetParams}
				onUndo={handleUndo}
				onRedo={handleRedo}
			/>

			{/* Sliders */}
			<SimulatorSliders
				simulator={simulator}
				onParameterChange={scheduleUpdate}
				version={sliderVersion.value}
			/>

			{/* Results table */}
			<SimulatorResultsTable simulations={simulations.value} />
		</div>
	);
}
