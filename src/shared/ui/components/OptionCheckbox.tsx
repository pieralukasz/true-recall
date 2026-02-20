import { useState } from "preact/hooks";

export interface OptionCheckboxProps {
	label: string;
	description: string;
	initialChecked: boolean;
	onChange: (val: boolean) => void;
}

export function OptionCheckbox({
	label,
	description,
	initialChecked,
	onChange,
}: OptionCheckboxProps) {
	const [checked, setChecked] = useState(initialChecked);

	return (
		<div class="ep:flex ep:items-start ep:gap-3 ep:py-2">
			<input
				type="checkbox"
				class="ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0 ep:mt-0.5"
				checked={checked}
				onChange={() => {
					const next = !checked;
					setChecked(next);
					onChange(next);
				}}
			/>
			<div>
				<div class="ep:text-ui-small ep:font-medium">{label}</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">{description}</div>
			</div>
		</div>
	);
}
