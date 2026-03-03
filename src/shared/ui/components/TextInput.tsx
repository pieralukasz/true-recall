import { useCallback } from "preact/hooks";

const BASE_CLS =
	"ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:transition-colors ep:disabled:opacity-50 ep:disabled:cursor-not-allowed";

export interface TextInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: "text" | "password";
	class?: string;
	disabled?: boolean;
}

export function TextInput({
	value,
	onChange,
	placeholder,
	type = "text",
	class: cls,
	disabled,
}: TextInputProps) {
	const handleInput = useCallback(
		(e: Event) => {
			onChange((e.target as HTMLInputElement).value);
		},
		[onChange],
	);

	return (
		<input
			type={type}
			value={value}
			placeholder={placeholder}
			onInput={handleInput}
			disabled={disabled}
			class={`${BASE_CLS} ${cls ?? ""}`}
		/>
	);
}
