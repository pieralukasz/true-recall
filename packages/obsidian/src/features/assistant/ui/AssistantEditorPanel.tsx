import { useEffect, useRef, useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { IconButton } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import { AskAiPrompt } from "./AskAiPrompt";
import { AssistantInlineTask } from "./AssistantInlineTask";
import { handoffUnfinishedThread } from "./thread-handoff";

interface AssistantEditorPanelProps {
	context: AssistantContext;
	onClose: () => void;
}

/** Prompt → thread lifecycle for the quick note editor's AI panel. On unmount
 * (panel toggled off or editor closed) an unfinished thread is handed off to
 * the AI Inbox instead of being lost. */
export function AssistantEditorPanel({
	context,
	onClose,
}: AssistantEditorPanelProps) {
	const plugin = usePlugin();
	const [threadId, setThreadId] = useState<string | null>(null);
	const threadIdRef = useRef<string | null>(null);
	threadIdRef.current = threadId;

	useEffect(() => {
		return () => {
			if (threadIdRef.current)
				handoffUnfinishedThread(plugin, threadIdRef.current);
		};
	}, [plugin]);

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:min-w-0">
			<div class="ep:flex ep:items-center ep:gap-2">
				<span class="ep:flex-1 ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Ask AI
				</span>
				<IconButton
					icon="x"
					ariaLabel="Close AI panel"
					size="small"
					onClick={onClose}
				/>
			</div>
			{threadId ? (
				<AssistantInlineTask
					threadId={threadId}
					onClose={onClose}
					framed={false}
				/>
			) : (
				<AskAiPrompt
					context={context}
					onSubmitted={(id, mode) => {
						if (mode === "inbox") {
							void plugin.openAssistantInbox();
							onClose();
							return;
						}
						if (mode === "background") {
							onClose();
							return;
						}
						setThreadId(id);
					}}
					onDismiss={onClose}
				/>
			)}
		</div>
	);
}
