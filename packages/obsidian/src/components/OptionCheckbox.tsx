export interface OptionCheckboxProps {
	label: string;
	description: string;
	checked: boolean;
	onChange: (val: boolean) => void;
	disabled?: boolean;
}

export function OptionCheckbox({
	label,
	description,
	checked,
	onChange,
	disabled,
}: OptionCheckboxProps) {
	return (
		<div
			class={`ep:flex ep:items-start ep:gap-3 ep:py-2${disabled ? " ep:opacity-50" : ""}`}
		>
			<input
				type="checkbox"
				class="ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0 ep:mt-0.5"
				checked={checked}
				disabled={disabled}
				onChange={() => onChange(!checked)}
			/>
			<div>
				<div class="ep:text-ui-small ep:font-medium">{label}</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">{description}</div>
			</div>
		</div>
	);
}
