import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import { AskAiPrompt } from "./AskAiPrompt";
import { AssistantInlineTask } from "./AssistantInlineTask";
import type { AIWorkspaceMode } from "./ai-workspace-modes";
import { useAssistantThread } from "./useAssistantThread";

interface AssistantEditorPanelProps {
	context: AssistantContext;
	onClose: () => void;
	initialMode?: AIWorkspaceMode;
}

/** The contextual AI workspace as hosted by a popout window: the surface goes
 * away when the thread is done, because the window has nothing else to show. */
export function AssistantEditorPanel({
	context,
	onClose,
	initialMode = "assistant",
}: AssistantEditorPanelProps) {
	const plugin = usePlugin();
	const { threadId, showThread } = useAssistantThread();

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
					entry="compose"
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
						showThread(id);
					}}
					onDismiss={onClose}
				/>
			)}
		</div>
	);
}
