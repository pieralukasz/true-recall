import { useState } from "preact/hooks";

import { AskAiPrompt } from "@true-recall/obsidian/features/assistant/ui/AskAiPrompt";
import { AssistantInlineTask } from "@true-recall/obsidian/features/assistant/ui/AssistantInlineTask";
import { AssistantSubjectStrip } from "@true-recall/obsidian/features/assistant/ui/AssistantSubjectStrip";
import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";
import { useAssistantThread } from "@true-recall/obsidian/features/assistant/ui/useAssistantThread";
import { useLiveAssistantContext } from "@true-recall/obsidian/features/assistant/ui/useLiveAssistantContext";
import { usePlugin } from "@true-recall/obsidian/preact";

interface AssistantWorkspaceAppProps {
	initialMode?: AIWorkspaceMode;
}

/** The docked AI workspace. Unlike the popout and modal surfaces it outlives a
 * single question: the subject follows whatever the user is studying, and
 * finishing a thread returns to the prompt instead of closing anything. */
export function AssistantWorkspaceApp({
	initialMode = "assistant",
}: AssistantWorkspaceAppProps) {
	const plugin = usePlugin();
	const [hasDraft, setHasDraft] = useState(false);
	const context = useLiveAssistantContext(hasDraft);
	const { threadId, showThread, clearThread } = useAssistantThread();

	return (
		<div class="tr-assistant-workspace-view ep:flex ep:flex-col ep:h-full ep:min-w-0">
			<AssistantSubjectStrip context={context} isPinned={hasDraft} />

			<div class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
				{threadId ? (
					<AssistantInlineTask
						threadId={threadId}
						framed={false}
						onClose={clearThread}
					/>
				) : (
					<AskAiPrompt
						context={context}
						presentation="workspace"
						initialMode={initialMode}
						autoFocus={false}
						onDraftChange={setHasDraft}
						onSubmitted={(id, mode) => {
							if (mode === "inbox") {
								void plugin.openAssistantInbox();
								return;
							}
							if (mode === "background") return;
							showThread(id);
						}}
						onDismiss={clearThread}
					/>
				)}
			</div>
		</div>
	);
}
