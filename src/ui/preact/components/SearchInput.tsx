import { useRef, useEffect } from "preact/hooks";

export interface SearchInputProps {
	value: string;
	placeholder: string;
	onChange: (query: string) => void;
	autoFocus?: boolean;
	class?: string;
}

export function SearchInput({
	value,
	placeholder,
	onChange,
	autoFocus = false,
	class: cls,
}: SearchInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (autoFocus) {
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [autoFocus]);

	return (
		<div class={cls ?? ""}>
			<input
				ref={inputRef}
				type="text"
				class="ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
				placeholder={placeholder}
				value={value}
				onInput={(e) => onChange((e.target as HTMLInputElement).value.toLowerCase())}
			/>
		</div>
	);
}
