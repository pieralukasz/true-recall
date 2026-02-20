import { useCallback } from "preact/hooks";

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectOptionGroup {
	label: string;
	options: SelectOption[];
}

export type SelectInputOption = SelectOption | SelectOptionGroup;

export interface SelectInputProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectInputOption[];
	disabled?: boolean;
	class?: string;
}

function isOptionGroup(opt: SelectInputOption): opt is SelectOptionGroup {
	return "options" in opt;
}

export function SelectInput({
	value,
	onChange,
	options,
	disabled,
	class: cls,
}: SelectInputProps) {
	const handleChange = useCallback(
		(e: Event) => {
			onChange((e.target as HTMLSelectElement).value);
		},
		[onChange],
	);

	return (
		<select
			class={`dropdown ${cls ?? ""}`}
			value={value}
			onChange={handleChange}
			disabled={disabled}
		>
			{options.map((opt) =>
				isOptionGroup(opt) ? (
					<optgroup key={opt.label} label={opt.label}>
						{opt.options.map((o) => (
							<option key={o.value} value={o.value} disabled={o.disabled}>
								{o.label}
							</option>
						))}
					</optgroup>
				) : (
					<option key={opt.value} value={opt.value} disabled={opt.disabled}>
						{opt.label}
					</option>
				),
			)}
		</select>
	);
}
