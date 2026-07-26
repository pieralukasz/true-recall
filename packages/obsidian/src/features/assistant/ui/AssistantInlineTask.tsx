import type { AssistantThread } from "@true-recall/core/ai/assistant";

import { StatusPill } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { cn } from "@true-recall/obsidian/utils/cn";

import { ThreadWorkspace } from "./ThreadWorkspace";

interface AssistantInlineTaskProps {
	threadId: string;
	onClose: () => void;
	/** Wrap in the floating surface (popover). Popout/modal hosts provide
	 * their own chrome and pass false. */
	framed?: boolean;
}

/** Keeps a submitted task next to the place where it was requested. */
export function AssistantInlineTask({
	threadId,
	onClose,
	framed = true,
}: AssistantInlineTaskProps) {
	const threads = useQuery<AssistantThread[]>(Q.ASSISTANT_THREADS).value ?? [];
	const thread = threads.find((candidate) => candidate.id === threadId);

	return (
		<div class={cn(framed && "tr-assistant-surface")}>
			{thread ? (
				<ThreadWorkspace thread={thread} onClose={onClose} />
			) : (
				<StatusPill label="Finishing…" />
			)}
		</div>
	);
}
