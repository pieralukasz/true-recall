import { useCallback } from "preact/hooks";

import { cn } from "@true-recall/obsidian/utils/cn";

import { useFormVariant } from "./FormVariantContext";

const CARD_CLS =
	"ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:transition-colors ep:disabled:opacity-50 ep:disabled:cursor-not-allowed";

interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

interface SelectOptionGroup {
	label: string;
	options: SelectOption[];
}

type SelectInputOption = SelectOption | SelectOptionGroup;

interface SelectInputProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectInputOption[];
	disabled?: boolean;
	class?: string;
	ariaLabel?: string;
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
	ariaLabel,
}: SelectInputProps) {
	const variant = useFormVariant();
	const handleChange = useCallback(
		(e: Event) => {
			onChange((e.target as HTMLSelectElement).value);
		},
		[onChange],
	);

	const baseCls = variant === "native" ? "dropdown" : CARD_CLS;

	return (
		<select
			class={cn(baseCls, cls)}
			value={value}
			onChange={handleChange}
			disabled={disabled}
			aria-label={ariaLabel}
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
