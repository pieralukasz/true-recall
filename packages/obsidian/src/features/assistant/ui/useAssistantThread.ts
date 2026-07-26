import { useEffect, useRef, useState } from "preact/hooks";

import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";

import { handoffUnfinishedThread } from "./thread-handoff";

export interface AssistantThreadHandle {
	threadId: string | null;
	showThread: (threadId: string) => void;
	clearThread: () => void;
}

/**
 * Prompt → thread lifecycle shared by every AI surface that hosts a thread
 * inline. On unmount an unfinished thread is handed off to the AI Inbox instead
 * of being lost, whichever surface it started on.
 */
export function useAssistantThread(): AssistantThreadHandle {
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

	return {
		threadId,
		showThread: setThreadId,
		clearThread: () => setThreadId(null),
	};
}
