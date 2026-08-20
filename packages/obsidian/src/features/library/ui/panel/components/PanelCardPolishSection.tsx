import type { AIWorkflow } from "@true-recall/core/ai/workflows/ai-workflow";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { AiPresetList } from "@true-recall/obsidian/features/assistant/ui/AiPresetList";
import {
	isCardPolishAvailable,
	listCardPolishWorkflows,
	startCardPolish,
} from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

/** Card Polish presets, one-click runnable, shown right under Scheduling
 * Details in the card detail view. Renders the same preset rows as the review
 * view's AI menu so both surfaces look identical. */
export function PanelCardPolishSection({ card }: { card: FSRSFlashcardItem }) {
	const plugin = usePlugin();
	if (!isCardPolishAvailable(plugin.settings)) return null;
	const workflows = listCardPolishWorkflows(plugin.settings);
	if (workflows.length === 0) return null;

	const runWorkflow = (workflow: AIWorkflow) => {
		startCardPolish(plugin, workflow, card);
		notify().info(`Polishing card with ${workflow.name}…`);
	};

	return (
		<details class="ep:border-b ep:border-obs-border/50 ep:px-3 ep:py-2">
			<summary class="ep:cursor-pointer ep:text-ui-small ep:text-obs-muted ep:touch-manipulation">
				Card Polish
			</summary>
			<div class="ep:mt-2">
				<AiPresetList
					workflows={workflows}
					onRun={runWorkflow}
					emptyLabel="No Card Polish presets yet"
				/>
			</div>
		</details>
	);
}
