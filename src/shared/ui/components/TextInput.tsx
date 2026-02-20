import { useCallback } from "preact/hooks";

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
			class={cls ?? ""}
		/>
	);
}
