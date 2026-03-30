import { cn } from "@true-recall/obsidian/utils";
import { useCallback } from "preact/hooks";

export interface ToggleInputProps {
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
	const handleClick = useCallback(() => {
		if (!disabled) onChange(!value);
	}, [value, onChange, disabled]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!disabled && (e.key === "Enter" || e.key === " ")) {
				e.preventDefault();
				onChange(!value);
			}
		},
		[value, onChange, disabled],
	);

	return (
		<div
			class={cn(
				"checkbox-container",
				value && "is-enabled",
				disabled && "ep:opacity-50 ep:cursor-not-allowed",
			)}
			role="switch"
			tabIndex={0}
			aria-checked={value}
			aria-label={ariaLabel}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		/>
	);
}
