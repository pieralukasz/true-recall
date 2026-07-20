/** Structural subset of AssistantThread/AssistantTask so the panel can count
 * pending AI work for a note without full fixtures in tests. */
export interface AssistantNoteItem {
	id: string;
	threadId?: string;
	context: {
		activeNotePath?: string;
		source?: { path?: string };
	};
}

function matchesNote(item: AssistantNoteItem, notePath: string): boolean {
	return (
		item.context.activeNotePath === notePath ||
		item.context.source?.path === notePath
	);
}

export function assistantItemsForNote(input: {
	threads: AssistantNoteItem[];
	tasks: AssistantNoteItem[];
	notePath: string | null | undefined;
}): { count: number; firstThreadId: string | null } {
	const { threads, tasks, notePath } = input;
	if (!notePath) return { count: 0, firstThreadId: null };
	const matchingThreads = threads.filter((t) => matchesNote(t, notePath));
	const standaloneTasks = tasks.filter(
		(t) => !t.threadId && matchesNote(t, notePath),
	);
	return {
		count: matchingThreads.length + standaloneTasks.length,
		firstThreadId: matchingThreads[0]?.id ?? null,
	};
}
