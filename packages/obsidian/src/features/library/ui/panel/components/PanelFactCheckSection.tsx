import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { ActionButton } from "@true-recall/obsidian/components";
import {
	FACT_CHECK_QUEUED_MESSAGE,
	isFactCheckAvailable,
	startFactCheck,
} from "@true-recall/obsidian/features/assistant/ui/fact-check";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

/** One-click fact check from the card detail view, right under Card Polish.
 * The verdict lands in the AI inbox, so this surface only queues. */
export function PanelFactCheckSection({ card }: { card: FSRSFlashcardItem }) {
	const plugin = usePlugin();
	if (!isFactCheckAvailable(plugin.settings)) return null;

	const run = () => {
		const taskId = startFactCheck(plugin, card);
		if (taskId) notify().info(FACT_CHECK_QUEUED_MESSAGE);
		else notify().error("AI assistant is not running");
	};

	return (
		<details class="ep:border-b ep:border-obs-border/50 ep:px-3 ep:py-2">
			<summary class="ep:cursor-pointer ep:text-ui-small ep:text-obs-muted ep:touch-manipulation">
				Fact check
			</summary>
			<div class="ep:mt-2">
				<ActionButton
					label="Check this card against the web"
					icon="search-check"
					variant="secondary"
					size="sm"
					onClick={run}
				/>
			</div>
		</details>
	);
}
