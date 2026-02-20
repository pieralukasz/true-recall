import { useCallback } from "preact/hooks";

export interface TextAreaInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	rows?: number;
	class?: string;
	disabled?: boolean;
}

export function TextAreaInput({
	value,
	onChange,
	placeholder,
	rows = 3,
	class: cls,
	disabled,
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
			disabled={disabled}
			class={cls ?? ""}
		/>
	);
}
