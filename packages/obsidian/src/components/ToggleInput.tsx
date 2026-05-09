import type { JSX } from "preact";
import { useCallback } from "preact/hooks";

import { cn } from "@true-recall/obsidian/utils/cn";

interface ToggleInputProps {
	value: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
	ariaLabel?: string;
}

export function ToggleInput({
	value,
	onChange,
	disabled,
	ariaLabel,
}: ToggleInputProps) {
	const handleChange = useCallback(
		(e: JSX.TargetedEvent<HTMLInputElement>) => {
			if (!disabled) onChange(e.currentTarget.checked);
		},
		[onChange, disabled],
	);

	return (
		<label
			class={cn(
				"tr-toggle",
				value && "tr-toggle--on",
				disabled && "tr-toggle--disabled",
			)}
		>
			<input
				type="checkbox"
				class="tr-toggle__input"
				checked={value}
				disabled={disabled}
				aria-label={ariaLabel}
				onChange={handleChange}
			/>
			<span class="tr-toggle__thumb" />
		</label>
	);
}
