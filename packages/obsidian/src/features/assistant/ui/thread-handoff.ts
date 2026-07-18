import type TrueRecallPlugin from "@true-recall/obsidian/main";

export type ThreadHandoff = "defer" | "archive" | "none";

/** Structural subset of AssistantThread so pure tests need no full fixtures. */
export interface ThreadHandoffInput {
	state: string;
	activeTaskId?: string | null;
	manifest?: { proposals: Array<{ status: string }> } | null;
}

export function resolveThreadHandoff(
	thread: ThreadHandoffInput | null | undefined,
): ThreadHandoff {
	if (!thread || thread.state !== "active") return "none";
	const hasPending =
		!!thread.activeTaskId ||
		!!thread.manifest?.proposals.some((p) => p.status === "proposed");
	return hasPending ? "defer" : "archive";
}

/** Shared close-time handoff: a thread with pending work goes to the AI Inbox
 * ("Later"), a settled one is archived. Used by every assistant host. */
export function handoffUnfinishedThread(
	plugin: TrueRecallPlugin,
	threadId: string,
): void {
	const thread = plugin.assistantService?.getThread(threadId);
	const action = resolveThreadHandoff(thread);
	if (action === "defer") plugin.assistantService?.deferThread(threadId);
	else if (action === "archive")
		plugin.assistantService?.archiveThread(threadId);
}
