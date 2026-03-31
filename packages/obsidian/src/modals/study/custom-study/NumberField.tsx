import { FormField } from "@true-recall/obsidian/components";

export interface NumberFieldProps {
	id: string;
	label: string;
	description?: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}

const NUM_INPUT_CLS =
	"ep:w-20 ep:py-1.5 ep:px-2.5 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:text-right";

export function NumberField({
	id,
	label,
	description,
	value,
	onChange,
	min = 0,
	max,
	step = 1,
}: NumberFieldProps) {
	return (
		<FormField name={label} description={description}>
			<input
				id={id}
				type="number"
				class={NUM_INPUT_CLS}
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => {
					const raw = Number((e.target as HTMLInputElement).value) || min;
					let clamped = Math.max(min, raw);
					if (max !== undefined) clamped = Math.min(max, clamped);
					onChange(clamped);
				}}
			/>
		</FormField>
	);
}
