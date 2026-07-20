import { useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";
import { listAIWorkflows } from "@true-recall/core/ai/workflows/ai-workflow";

import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { cn } from "@true-recall/obsidian/utils/cn";

import { AiComposer } from "./AiComposer";

interface AskAiPromptProps {
	context: AssistantContext;
	onSubmitted: (
		threadId: string,
		mode: "inline" | "inbox" | "background",
	) => void;
	onDismiss: () => void;
	autoFocus?: boolean;
	class?: string;
}

export function AskAiPrompt({
	context,
	onSubmitted,
	onDismiss,
	autoFocus = true,
	class: cls,
}: AskAiPromptProps) {
	const plugin = usePlugin();
	const [text, setText] = useState("");
	const workflows = listAIWorkflows(plugin.settings, {
		hasSelection: !!context.selectedText?.trim(),
		hasCard: !!context.card,
		hasDraftCard: !!context.draftCard,
	});
	const selectedText = context.selectedText?.trim();
	const canSend = text.trim() !== "";

	const submit = (
		instruction: string,
		presetId: string | undefined,
		mode: "inline" | "inbox" | "background",
		displayMessage?: string,
	) => {
		const trimmed = instruction.trim();
		if (trimmed === "" || !plugin.assistantService) return;
		const { threadId } = plugin.assistantService.startThread({
			instruction: trimmed,
			presetId,
			context,
			state: mode === "inline" ? "active" : "inbox",
			displayMessage,
		});
		if (mode === "background") {
			notify().info(
				`Generating with ${displayMessage ?? "preset"} in the background…`,
			);
		}
		onSubmitted(threadId, mode);
	};

	return (
		<AiComposer
			class={cls}
			value={text}
			onChange={setText}
			onSubmit={() => submit(text, undefined, "inline")}
			onDismiss={onDismiss}
			autoFocus={autoFocus}
			placeholder="Ask AI about this… (Enter = run here, Shift+Enter = newline)"
			header={
				selectedText ? (
					<div class="ep:flex ep:flex-col ep:gap-1 ep:p-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-surface-raised">
						<div class="ep:text-ui-smaller ep:font-semibold ep:uppercase ep:tracking-wide ep:text-obs-muted">
							Selected text
						</div>
						<div class="ep:text-ui-small ep:whitespace-pre-wrap ep:break-words ep:text-obs-normal">
							{selectedText}
						</div>
					</div>
				) : undefined
			}
			chips={workflows.map((workflow) => (
				<Clickable
					key={workflow.id}
					class="ep:px-2.5 ep:py-0.5 ep:text-ui-smaller ep:bg-obs-modifier-hover ep:hover:bg-obs-border ep:rounded-full"
					title={workflow.instruction}
					onClick={() =>
						submit(
							workflow.instruction,
							workflow.id,
							workflow.kind === "generate-cards" ? "background" : "inline",
							workflow.name,
						)
					}
				>
					{workflow.name}
				</Clickable>
			))}
			trailing={
				<Clickable
					class={cn(
						"ep:px-2 ep:py-0.5 ep:rounded-md ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover",
						!canSend && "ep:opacity-50",
					)}
					disabled={!canSend}
					title="Run and open the AI inbox"
					onClick={() => submit(text, undefined, "inbox")}
				>
					Run &amp; show
				</Clickable>
			}
		/>
	);
}
