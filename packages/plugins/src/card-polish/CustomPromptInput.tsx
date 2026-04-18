import { useEffect, useRef, useState } from "preact/hooks";

interface CustomPromptInputProps {
	recent: string[];
	onSubmit: (instruction: string) => void;
	onCancel: () => void;
}

export function CustomPromptInput({
	recent,
	onSubmit,
	onCancel,
}: CustomPromptInputProps) {
	const [value, setValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<div class="ep:absolute ep:z-50 ep:min-w-[320px] ep:flex ep:flex-col ep:gap-2 ep:p-2 ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-primary ep:shadow-lg">
			<input
				ref={inputRef}
				type="text"
				placeholder="Describe what to do with this card…"
				value={value}
				onInput={(e) => setValue((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
					if (e.key === "Escape") onCancel();
				}}
				class="ep:w-full ep:py-1.5 ep:px-2 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:bg-obs-primary ep:text-obs-normal ep:focus:outline-none ep:focus:border-obs-interactive"
			/>
			{recent.length > 0 && (
				<div class="ep:flex ep:flex-wrap ep:gap-1">
					{recent.map((r) => (
						<button
							key={r}
							type="button"
							onClick={() => onSubmit(r)}
							class="ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:rounded ep:border ep:border-obs-border ep:bg-obs-secondary ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:cursor-pointer ep:truncate ep:max-w-[220px]"
							title={r}
						>
							{r}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
