import { useEffect, useRef, useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

/** Cap the auto-growing textarea so a long draft scrolls instead of shoving the toolbar off-screen. */
const MAX_INPUT_HEIGHT = 200;

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
	const canSend = text.trim() !== "";

	const adjustHeight = () => {
		const el = inputRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
	};

	useEffect(() => {
		adjustHeight();
		if (autoFocus) inputRef.current?.focus();
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
		<div class="tr-ask-ai-box">
			{selectedText && (
				<div class="tr-ask-ai-selected">
					<div class="tr-ask-ai-selected-label">Selected text</div>
					<div class="tr-ask-ai-selected-text">{selectedText}</div>
				</div>
			)}
			<textarea
				ref={inputRef}
				class="tr-ask-ai-field"
				placeholder="Ask AI about this… (Enter = queue, Shift+Enter = newline)"
				rows={1}
				value={text}
				onInput={(e) => {
					setText((e.target as HTMLTextAreaElement).value);
					adjustHeight();
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit(text, undefined, false);
					}
					if (e.key === "Escape") onDismiss();
				}}
			/>
			<div class="tr-ask-ai-toolbar">
				<div class="tr-ask-ai-presets">
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
				<div class="tr-ask-ai-send-group">
					<Clickable
						class={cn("tr-ask-ai-run", !canSend && "is-disabled")}
						disabled={!canSend}
						title="Queue and open the AI inbox"
						onClick={() => submit(text, undefined, true)}
					>
						Run &amp; show
					</Clickable>
					<Clickable
						class="tr-ask-ai-send-btn"
						disabled={!canSend}
						aria-label="Queue"
						title="Queue (Enter)"
						onClick={() => submit(text, undefined, false)}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.4"
							stroke-linecap="round"
							stroke-linejoin="round"
							role="img"
							aria-hidden="true"
						>
							<path d="M12 19V5" />
							<path d="m5 12 7-7 7 7" />
						</svg>
					</Clickable>
				</div>
			</div>
		</div>
	);
}
