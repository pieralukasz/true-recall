import { useEffect, useRef, useState } from "preact/hooks";

import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import { AskAiPrompt } from "./AskAiPrompt";
import { AssistantInlineTask } from "./AssistantInlineTask";
import type { AIWorkspaceMode } from "./ai-workspace-modes";
import { handoffUnfinishedThread } from "./thread-handoff";

interface AssistantEditorPanelProps {
	context: AssistantContext;
	onClose: () => void;
	initialMode?: AIWorkspaceMode;
}

/** Prompt → thread lifecycle for the contextual AI workspace. On unmount
 * (window closed or editor session ended) an unfinished thread is handed off
 * to the AI Inbox instead of being lost. */
export function AssistantEditorPanel({
	context,
	onClose,
	initialMode = "assistant",
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
		<div class="tr-assistant-editor-panel ep:flex ep:flex-col ep:min-w-0">
			{threadId ? (
				<div class="tr-assistant-editor-thread">
					<AssistantInlineTask
						threadId={threadId}
						onClose={onClose}
						framed={false}
					/>
				</div>
			) : (
				<AskAiPrompt
					context={context}
					presentation="workspace"
					initialMode={initialMode}
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
