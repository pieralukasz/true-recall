import { useCallback } from "preact/hooks";

const BASE_CLS =
	"ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:transition-colors ep:resize-y ep:disabled:opacity-50 ep:disabled:cursor-not-allowed";

export interface TextAreaInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	rows?: number;
	class?: string;
	disabled?: boolean;
	onKeyDown?: (event: KeyboardEvent) => void;
}

export function TextAreaInput({
	value,
	onChange,
	placeholder,
	rows = 3,
	class: cls,
	disabled,
	onKeyDown,
}: TextAreaInputProps) {
	const handleInput = useCallback(
		(e: Event) => {
			onChange((e.target as HTMLTextAreaElement).value);
		},
		[onChange],
	);

	return (
		<textarea
			value={value}
			placeholder={placeholder}
			rows={rows}
			onInput={handleInput}
			onKeyDown={onKeyDown}
			disabled={disabled}
			class={`${BASE_CLS} ${cls ?? ""}`}
		/>
	);
}
