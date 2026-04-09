import { useCallback } from "preact/hooks";

import type { SimulatorApi } from "@true-recall/obsidian/store";

import { ALL_SLIDERS } from "../constants";
import { SimulatorSliderRow } from "./SimulatorSliderRow";

interface SimulatorSlidersProps {
	simulator: SimulatorApi;
	onParameterChange: () => void;
	/** Bumped to force re-read of slider values (undo/redo/reset) */
	version: number;
}

export function SimulatorSliders({
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
