import { Clickable } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact";
import { useCallback, useRef, useState } from "preact/hooks";

interface Props {
	onSend: (text: string) => void;
	disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
	const [text, setText] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const sendIconRef = useIcon("send-horizontal");

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

	const canSend = text.trim() && !disabled;

	return (
		<div class="ep:px-2 ep:py-3 ep:border-t ep:border-obs-border ep:flex ep:items-center ep:gap-2">
			<textarea
				ref={textareaRef}
				class="ep:flex-1 ep:resize-y ep:rounded-xl ep:bg-obs-secondary ep:px-3 ep:py-3 ep:text-obs-normal ep:text-sm ep:outline-none ep:border-none ep:shadow-none ep:appearance-none ep:min-h-[2.5rem] ep:max-h-[200px] ep:leading-normal ep:placeholder:text-obs-muted ep:focus:shadow-none"
				placeholder="Ask about your notes..."
				value={text}
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				rows={1}
			/>
			<Clickable
				class={`ep:flex ep:items-center ep:justify-center ep:shrink-0 ep:transition-colors [&_svg]:ep:w-4 [&_svg]:ep:h-4 ${
					canSend
						? "ep:text-obs-interactive ep:hover:text-obs-interactive-hover"
						: "ep:text-obs-muted ep:opacity-50"
				}`}
				onClick={handleSend}
				aria-disabled={!canSend}
			>
				<span ref={sendIconRef} />
			</Clickable>
		</div>
	);
}
