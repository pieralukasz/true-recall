import { useCallback, useState } from "preact/hooks";

import { decimalsOf, snapToStep } from "./slider-input.utils";

const BOX_CLS =
	"ep:w-16 ep:py-1 ep:px-2 ep:text-right ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-smaller ep:focus:outline-none ep:focus:border-obs-interactive ep:transition-colors ep:disabled:opacity-50 ep:disabled:cursor-not-allowed";

interface SliderInputProps {
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
	step: number;
	formatTooltip?: (value: number) => string;
	disabled?: boolean;
	/**
	 * Accept typed values above `max`. Only for sliders whose ceiling is derived
	 * from the current value, so the track rescales around whatever is committed.
	 */
	allowAboveMax?: boolean;
	ariaLabel?: string;
}

export function SliderInput({
	value,
	onChange,
	min,
	max,
	step,
	formatTooltip,
	disabled,
	allowAboveMax = false,
	ariaLabel,
}: SliderInputProps) {
	// Typing is buffered so intermediate states ("4" on the way to "462") are not
	// clamped and saved on every keystroke; null means "show the committed value".
	const [draft, setDraft] = useState<string | null>(null);

	const handleInput = useCallback(
		(e: Event) => {
			setDraft(null);
			onChange(Number((e.target as HTMLInputElement).value));
		},
		[onChange],
	);

	const commitDraft = useCallback(() => {
		if (draft === null) return;
		const parsed = Number(draft);
		setDraft(null);
		if (draft.trim() === "" || Number.isNaN(parsed)) return;
		const next = snapToStep(parsed, min, max, step, allowAboveMax);
		if (next !== value) onChange(next);
	}, [draft, min, max, step, allowAboveMax, value, onChange]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				commitDraft();
				(e.target as HTMLInputElement).blur();
			} else if (e.key === "Escape") {
				e.preventDefault();
				setDraft(null);
			}
		},
		[commitDraft],
	);

	const display = value.toFixed(decimalsOf(step));
	const tooltip = formatTooltip?.(value);

	return (
		<div class="ep:flex ep:items-center ep:gap-2">
			<input
				type="range"
				min={min}
				max={Math.max(max, value)}
				step={step}
				value={value}
				onInput={handleInput}
				disabled={disabled}
				aria-label={ariaLabel}
			/>
			<input
				type="number"
				class={BOX_CLS}
				min={min}
				max={allowAboveMax ? undefined : max}
				step={step}
				value={draft ?? display}
				disabled={disabled}
				aria-label={ariaLabel}
				onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
				onBlur={commitDraft}
				onKeyDown={handleKeyDown}
			/>
			{tooltip && tooltip !== display && (
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:min-w-[3em]">
					{tooltip}
				</span>
			)}
		</div>
	);
}
