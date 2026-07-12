import { useEffect, useRef, useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

interface AskAiPromptProps {
	context: AssistantContext;
	onSubmitted: (taskId: string, showNow: boolean) => void;
	onDismiss: () => void;
	autoFocus?: boolean;
}

export function AskAiPrompt({
	context,
	onSubmitted,
	onDismiss,
	autoFocus = true,
}: AskAiPromptProps) {
	const plugin = usePlugin();
	const [text, setText] = useState("");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const presets = plugin.settings.assistantPresets ?? [];
	const selectedText = context.selectedText?.trim();

	useEffect(() => {
		if (!autoFocus) return;
		inputRef.current?.focus();
	}, [autoFocus]);

	const submit = (
		instruction: string,
		presetId: string | undefined,
		showNow: boolean,
	) => {
		const trimmed = instruction.trim();
		if (trimmed === "" || !plugin.assistantService) return;
		const taskId = plugin.assistantService.enqueue({
			instruction: trimmed,
			presetId,
			context,
		});
		onSubmitted(taskId, showNow);
	};

	return (
		<div class="tr-ask-ai-prompt">
			<div class="tr-ask-ai-chips">
				{presets.map((preset) => (
					<Clickable
						key={preset.id}
						class="tr-ask-ai-chip"
						title={preset.instruction}
						onClick={() => submit(preset.instruction, preset.id, false)}
					>
						{preset.name}
					</Clickable>
				))}
			</div>
			{selectedText && (
				<div class="tr-ask-ai-selected">
					<div class="tr-ask-ai-selected-label">Selected text</div>
					<div class="tr-ask-ai-selected-text">{selectedText}</div>
				</div>
			)}
			<textarea
				ref={inputRef}
				class="tr-ask-ai-input"
				placeholder="Ask AI about this… (Enter = queue, Shift+Enter = newline)"
				rows={3}
				value={text}
				onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit(text, undefined, false);
					}
					if (e.key === "Escape") onDismiss();
				}}
			/>
			<div class="tr-ask-ai-actions">
				<Clickable
					class="tr-ask-ai-btn"
					onClick={() => submit(text, undefined, false)}
				>
					Queue
				</Clickable>
				<Clickable
					class="tr-ask-ai-btn mod-cta"
					onClick={() => submit(text, undefined, true)}
				>
					Run &amp; show
				</Clickable>
			</div>
		</div>
	);
}
