import { useEffect, useState } from "preact/hooks";

import type {
	AssistantTask,
	AssistantThread,
} from "@true-recall/core/ai/assistant";

import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { isAiChatAvailable } from "@true-recall/obsidian/features/ai-chat/open-ai-chat";
import { assistantItemsForNote } from "@true-recall/obsidian/features/assistant/ui/assistant-note-match";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { usePlugin } from "@true-recall/obsidian/preact";

/** One-line signal under the panel header: pending AI drafts touching the
 * active note, deep-linking into the AI Inbox. Renders nothing when idle —
 * the panel signals, the inbox stays the only review surface. */
export function PanelAiStrip() {
	const plugin = usePlugin();
	if (plugin.aiChat && isAiChatAvailable(plugin)) return <PanelChatStrip />;
	return <PanelInboxStrip />;
}

/** "2 proposals waiting" for the active note, opening the AI chat that holds them. */
function PanelChatStrip() {
	const plugin = usePlugin();
	const { currentFile } = usePanelStore();
	const controller = plugin.aiChat;
	const [, setVersion] = useState(0);
	useEffect(
		() => controller?.subscribe(() => setVersion((v) => v + 1)),
		[controller],
	);
	if (!controller || !currentFile) return null;
	const { count, chatId } = controller.pendingForNote(currentFile.path);
	if (count === 0 || !chatId) return null;

	return (
		<Clickable
			class="ep:mx-2 ep:mt-2 ep:flex ep:items-center ep:gap-2 ep:px-2 ep:py-1.5 ep:rounded-md ep:border ep:border-obs-border ep:bg-surface-raised ep:shrink-0"
			aria-label="Open the AI chat with these proposals"
			onClick={() => void controller.continueInChat(chatId)}
		>
			<span aria-hidden="true">✨</span>
			<span class="ep:flex-1 ep:text-ui-smaller ep:text-obs-normal">
				{count} AI proposal{count === 1 ? "" : "s"} waiting
			</span>
			<span class="ep:text-ui-smaller ep:text-obs-accent">Open →</span>
		</Clickable>
	);
}

function PanelInboxStrip() {
	const plugin = usePlugin();
	const { currentFile } = usePanelStore();
	const threads = useQuery<AssistantThread[]>(Q.ASSISTANT_INBOX).value ?? [];
	const tasks = useQuery<AssistantTask[]>(Q.ASSISTANT_TASKS).value ?? [];
	const { count, firstThreadId } = assistantItemsForNote({
		threads,
		tasks,
		notePath: currentFile?.path ?? null,
	});

	if (count === 0) return null;

	return (
		<Clickable
			class="ep:mx-2 ep:mt-2 ep:flex ep:items-center ep:gap-2 ep:px-2 ep:py-1.5 ep:rounded-md ep:border ep:border-obs-border ep:bg-surface-raised ep:shrink-0"
			aria-label="Open AI drafts for this note"
			onClick={() => void plugin.openAssistantInbox(firstThreadId ?? undefined)}
		>
			<span aria-hidden="true">✨</span>
			<span class="ep:flex-1 ep:text-ui-smaller ep:text-obs-normal">
				{count} AI draft{count === 1 ? "" : "s"} for this note
			</span>
			<span class="ep:text-ui-smaller ep:text-obs-accent">Open →</span>
		</Clickable>
	);
}
