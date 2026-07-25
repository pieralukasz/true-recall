import type { AssistantContext } from "@true-recall/core/ai/assistant";

import { describeAssistantContext } from "./ai-context-source";

interface AssistantSubjectStripProps {
	context: AssistantContext;
	/** True while the subject is held still because the user is mid-sentence. */
	isPinned: boolean;
}

/** Names what the next run will act on. In the docked workspace the subject
 * follows the review queue, so showing it — and showing when it is held still —
 * is the difference between trust and surprise. */
export function AssistantSubjectStrip({
	context,
	isPinned,
}: AssistantSubjectStripProps) {
	const kind = context.card ? "Card" : context.activeNotePath ? "Note" : null;

	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:px-2 ep:py-1.5 ep:shrink-0 ep:border-b ep:border-obs-border">
			<span aria-hidden="true">{isPinned ? "📌" : "🎯"}</span>
			<span class="ep:flex-1 ep:min-w-0">
				{kind ? (
					<span class="ep:text-ui-smaller ep:text-obs-faint">{kind}: </span>
				) : null}
				<span
					class="ep:text-ui-smaller ep:text-obs-normal ep:truncate"
					title={describeAssistantContext(context)}
				>
					{describeAssistantContext(context)}
				</span>
			</span>
			{isPinned ? (
				<span class="ep:text-ui-smaller ep:text-obs-faint">held</span>
			) : null}
		</div>
	);
}
