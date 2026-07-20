import type { TFile } from "obsidian";
import { useCallback, useRef, useState } from "preact/hooks";

import type {
	ContextItem,
	NoteContextItem,
} from "@true-recall/core/rag/context/context.types";
import { contextKey } from "@true-recall/core/rag/context/context.types";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";

import { ContextChip } from "../context/ContextChip";
import { SuggestionPopup } from "../context/SuggestionPopup";
import {
	getTriggerRange,
	useNoteSuggestions,
} from "../context/useNoteSuggestions";

interface Props {
	onSend: (text: string) => void;
	disabled: boolean;
	contextItems?: ContextItem[];
	onDismissContext?: (key: string) => void;
	onAddManualNote?: (item: NoteContextItem) => void;
}

export function ChatInput({
	onSend,
	disabled,
	contextItems,
	onDismissContext,
	onAddManualNote,
}: Props) {
	const [text, setText] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const sendIconRef = useIcon("send-horizontal");
	const suggestions = useNoteSuggestions();

	const confirmSuggestion = useCallback(
		(file: TFile) => {
			const ta = textareaRef.current;
			if (!ta) return;
			const range = getTriggerRange(text, ta.selectionStart);
			if (range) {
				const before = text.slice(0, range.start);
				const after = text.slice(range.end);
				setText(before + after);
			}
			suggestions.close();
			onAddManualNote?.({
				kind: "manual-note",
				path: file.path,
				basename: file.basename,
				auto: false,
			});
		},
		[text, suggestions, onAddManualNote],
	);

	const handleSend = useCallback(() => {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setText("");
		suggestions.close();
		if (textareaRef.current)
			textareaRef.current.setCssStyles({ height: "auto" });
	}, [text, disabled, onSend, suggestions]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (suggestions.isActive) {
				switch (e.key) {
					case "ArrowDown":
						e.preventDefault();
						suggestions.selectNext();
						return;
					case "ArrowUp":
						e.preventDefault();
						suggestions.selectPrev();
						return;
					case "Enter": {
						e.preventDefault();
						const file = suggestions.confirm();
						if (file) confirmSuggestion(file);
						return;
					}
					case "Escape":
						e.preventDefault();
						suggestions.close();
						return;
				}
			}
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[suggestions, confirmSuggestion, handleSend],
	);

	const handleInput = useCallback(
		(e: Event) => {
			const target = e.target as HTMLTextAreaElement;
			setText(target.value);
			target.setCssStyles({ height: "auto" });
			target.setCssStyles({
				height: `${Math.min(target.scrollHeight, 120)}px`,
			});
			suggestions.handleTrigger(target.value, target.selectionStart);
		},
		[suggestions],
	);

	const canSend = text.trim() && !disabled;
	const hasContext = contextItems && contextItems.length > 0;

	return (
		<div class="ep:relative ep:px-2 ep:py-3 ep:border-t ep:border-obs-border">
			{hasContext && (
				<div class="ep:flex ep:flex-wrap ep:gap-1 ep:mb-2">
					{contextItems.map((item) => {
						const key = contextKey(item);
						return (
							<ContextChip
								key={key}
								item={item}
								onDismiss={() => onDismissContext?.(key)}
							/>
						);
					})}
				</div>
			)}
			{suggestions.isActive && (
				<SuggestionPopup
					suggestions={suggestions.suggestions}
					highlightIndex={suggestions.highlightIndex}
					onSelect={confirmSuggestion}
					onHover={(i) => suggestions.setIndex(i)}
				/>
			)}
			<div class="ep:flex ep:items-center ep:gap-2">
				<textarea
					ref={textareaRef}
					class="ep:flex-1 ep:resize-y ep:rounded-xl ep:bg-obs-secondary ep:px-3 ep:py-3 ep:text-obs-normal ep:text-sm ep:outline-none ep:border-none ep:shadow-none ep:appearance-none ep:min-h-[2.5rem] ep:max-h-[200px] ep:leading-normal ep:placeholder:text-obs-muted ep:focus:shadow-none"
					placeholder="Ask about your notes... (# to reference)"
					value={text}
					onInput={handleInput}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					rows={1}
				/>
				<Clickable
					class={`ep:flex ep:items-center ep:justify-center ep:shrink-0 ep:transition-colors ep:[&_svg]:w-4 ep:[&_svg]:h-4 ${
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
		</div>
	);
}
