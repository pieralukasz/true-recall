import { useCallback, useRef } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import type { SimulatorApi } from "@true-recall/obsidian/store";

import type { MetricType } from "../types";

interface SimulatorControlsProps {
	simulator: SimulatorApi;
	onSequencesChange: () => void;
	onMetricChange: () => void;
	onOptionsChange: () => void;
}

export function SimulatorControls({
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
			<Clickable
				class={[
					"ep:w-full ep:mb-3 ep:px-3 ep:py-2",
					"ep:bg-obs-primary ep:text-obs-normal",
					"ep:border ep:border-obs-border ep:rounded-lg",
					"ep:text-ui-small",
					"hover:ep:bg-obs-modifier-hover",
				].join(" ")}
				onClick={handleReset}
			>
				Reset reviews
			</Clickable>

			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-2">
				1=Again, 2=Hard, 3=Good, 4=Easy
			</div>

			<textarea
				ref={textareaRef}
				class={[
					"ep:w-full ep:h-37.5 ep:mb-4",
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
