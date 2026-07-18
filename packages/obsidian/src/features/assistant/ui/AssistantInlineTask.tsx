import type { AssistantThread } from "@true-recall/core/ai/assistant";

import { Q, useQuery } from "@true-recall/obsidian/data";
import { ThreadWorkspace } from "@true-recall/obsidian/views/assistant/AssistantInboxApp";

interface AssistantInlineTaskProps {
	threadId: string;
	onClose: () => void;
}

/** Keeps a submitted task next to the place where it was requested. */
export function AssistantInlineTask({
	threadId,
	onClose,
}: AssistantInlineTaskProps) {
	const threads = useQuery<AssistantThread[]>(Q.ASSISTANT_THREADS).value ?? [];
	const thread = threads.find((candidate) => candidate.id === threadId);

	if (!thread) {
		return (
			<div class="tr-ask-ai-box tr-assistant-inline-task">
				<span class="tr-inbox-status">Finishing…</span>
			</div>
		);
	}

	return <ThreadWorkspace thread={thread} onClose={onClose} inline />;
}
