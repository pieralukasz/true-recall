interface OptionCheckboxProps {
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
		<label
			class={`ep:flex ep:items-start ep:gap-3 ep:py-1.5${disabled ? " ep:opacity-50" : ""}`}
		>
			<input
				type="checkbox"
				class="ep:mt-0.5 ep:accent-obs-interactive ep:shrink-0"
				checked={checked}
				disabled={disabled}
				onChange={() => onChange(!checked)}
			/>
			<div>
				<div class="ep:text-ui-small ep:font-medium">{label}</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">{description}</div>
			</div>
		</label>
	);
}
