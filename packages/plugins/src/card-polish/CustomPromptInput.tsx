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
		<div className="tr-card-polish-custom">
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
			/>
			{recent.length > 0 && (
				<div className="tr-card-polish-custom-recent">
					{recent.map((r) => (
						<button key={r} type="button" onClick={() => onSubmit(r)}>
							{r}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
