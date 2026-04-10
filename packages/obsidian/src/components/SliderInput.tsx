import { useCallback } from "preact/hooks";

interface SliderInputProps {
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
	step: number;
	formatTooltip?: (value: number) => string;
	disabled?: boolean;
}

export function SliderInput({
	value,
	onChange,
	min,
	max,
	step,
	formatTooltip,
	disabled,
}: SliderInputProps) {
	const handleInput = useCallback(
		(e: Event) => {
			onChange(Number((e.target as HTMLInputElement).value));
		},
		[onChange],
	);

	return (
		<div class="ep:flex ep:items-center ep:gap-2">
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onInput={handleInput}
				disabled={disabled}
			/>
			{formatTooltip && (
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:min-w-[3em] ep:text-right">
					{formatTooltip(value)}
				</span>
			)}
		</div>
	);
}
