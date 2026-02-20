export const SECTION_CLS = "ep:mb-4";

export const LABEL_CLS =
	"ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1.5 ep:block";

export const INPUT_CLS =
	"ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive";

export interface NumberFieldProps {
	id: string;
	label: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}

export function NumberField({
	id,
	label,
	value,
	onChange,
	min = 0,
	max,
	step = 1,
}: NumberFieldProps) {
	return (
		<div class={SECTION_CLS}>
			<label htmlFor={id} class={LABEL_CLS}>
				{label}
			</label>
			<input
				id={id}
				type="number"
				class={INPUT_CLS}
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => {
					const raw =
						Number((e.target as HTMLInputElement).value) || min;
					let clamped = Math.max(min, raw);
					if (max !== undefined) clamped = Math.min(max, clamped);
					onChange(clamped);
				}}
			/>
		</div>
	);
}
