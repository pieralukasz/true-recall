import { useCallback } from "preact/hooks";

import { cn } from "@true-recall/obsidian/utils/cn";

/**
 * Obsidian styles bare `select` elements unlayered (`height`, `padding`,
 * `border`, `background`, `line-height`), which outranks anything in Tailwind's
 * `@layer utilities` no matter the specificity. Utility-based box styling
 * therefore never applied here — it only fought the fixed `height` and got the
 * value text clipped. Reusing `.dropdown` keeps Obsidian's own metrics and adds
 * the chevron, so card selects match the ones in the settings tab.
 */
const BASE_CLS =
	"dropdown ep:disabled:opacity-50 ep:disabled:cursor-not-allowed";

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
	const handleChange = useCallback(
		(e: Event) => {
			onChange((e.target as HTMLSelectElement).value);
		},
		[onChange],
	);

	return (
		<select
			class={cn(BASE_CLS, cls)}
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
