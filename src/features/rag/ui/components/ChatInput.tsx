import { Clickable } from "@shared/ui/components";
import { useCallback, useRef, useState } from "preact/hooks";

interface Props {
	onSend: (text: string) => void;
	disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
	const [text, setText] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = useCallback(() => {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setText("");
		if (textareaRef.current) textareaRef.current.style.height = "auto";
	}, [text, disabled, onSend]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const handleInput = useCallback((e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		setText(target.value);
		target.style.height = "auto";
		target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
	}, []);

	return (
		<div class="ep:flex ep:gap-2 ep:p-3 ep:border-t ep:border-obs-border">
			<textarea
				ref={textareaRef}
				class="ep:flex-1 ep:resize-none ep:bg-obs-modifier-hover ep:text-obs-normal ep:rounded-lg ep:px-3 ep:py-2 ep:text-sm ep:border ep:border-obs-border ep:outline-none ep:focus:border-obs-interactive"
				placeholder="Ask about your notes..."
				value={text}
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				rows={1}
			/>
			<Clickable
				class={`ep:px-3 ep:py-2 ep:rounded-lg ep:text-sm ep:font-medium ${
					text.trim() && !disabled
						? "ep:bg-obs-interactive ep:text-obs-on-accent"
						: "ep:bg-obs-modifier-hover ep:text-obs-muted"
				}`}
				onClick={handleSend}
				aria-disabled={!text.trim() || disabled}
			>
				Send
			</Clickable>
		</div>
	);
}
