export interface MediaWidthSliderProps {
	value: number;
	onChange: (width: number) => void;
	max?: number;
	step?: number;
	label?: string;
}

export function MediaWidthSlider({
	value,
	onChange,
	max = 800,
	step = 50,
	label = "Width",
}: MediaWidthSliderProps) {
	return (
		<div class="ep:flex ep:items-center ep:gap-3">
			<label
				htmlFor="media-width-slider"
				class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:shrink-0"
			>
				{label}
			</label>
			<input
				id="media-width-slider"
				type="range"
				class="ep:flex-1"
				min="0"
				max={max}
				step={step}
				value={value}
				onInput={(e) =>
					onChange(parseInt((e.target as HTMLInputElement).value, 10))
				}
			/>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-interactive ep:min-w-12.5 ep:text-right">
				{value === 0 ? "Auto" : `${value}px`}
			</span>
		</div>
	);
}
