import type {
	CustomStudyRequest,
	TemporaryCustomStudyDeck,
} from "@true-recall/core/types";

import { IconButton, PlayIcon } from "@true-recall/obsidian/components";
import { confirm } from "@true-recall/obsidian/modals/shared";
import { usePlugin } from "@true-recall/obsidian/preact";
import { isMobile } from "@true-recall/obsidian/utils/platform";

function getRequestTitle(request: CustomStudyRequest): string {
	switch (request.kind) {
		case "increase-new":
			return "Extra new cards";
		case "increase-review":
			return "Extra review cards";
		case "forgotten":
			return "Forgotten cards";
		case "actual-learning":
			return "Actual Learning";
		case "review-ahead":
			return "Review ahead";
		case "preview-new":
			return "Preview new cards";
		case "state-or-tag":
			return "Cards by state or tag";
	}
}

function describeRequest(request: CustomStudyRequest): string {
	switch (request.kind) {
		case "increase-new":
			return `+${request.amount} new`;
		case "increase-review":
			return `+${request.amount} reviews`;
		case "forgotten":
			return `Last ${request.days} day${request.days === 1 ? "" : "s"}`;
		case "actual-learning":
			return "Learning and Relearning";
		case "review-ahead":
			return `Next ${request.days} day${request.days === 1 ? "" : "s"}`;
		case "preview-new":
			return `Added in the last ${request.days} day${request.days === 1 ? "" : "s"}`;
		case "state-or-tag":
			return `${request.cardState === "all" ? "All cards" : request.cardState} · limit ${request.cardLimit}`;
	}
}

export function CustomStudySessionRow({
	deck,
}: {
	deck: TemporaryCustomStudyDeck;
}) {
	const plugin = usePlugin();
	const count = deck.cardIds.length;
	const title = getRequestTitle(deck.customStudy);
	const description = describeRequest(deck.customStudy);

	const handleDelete = async () => {
		const confirmed = await confirm(plugin.app, {
			title: "Delete Custom Study Session?",
			message:
				"The temporary deck will be removed. Its flashcards will not be deleted.",
			confirmLabel: "Delete deck",
		});
		if (confirmed) await plugin.deleteTemporaryCustomStudyDeck(deck.id);
	};

	return (
		<div class="ep:flex ep:items-center ep:gap-3 ep:px-3 ep:h-10 ep:overflow-hidden ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover">
			<span class="ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0 ep:bg-obs-blue" />

			<div class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0">
				<span
					class="ep:text-sm ep:text-obs-normal ep:font-medium ep:truncate ep:shrink-0"
					title={title}
				>
					{title}
				</span>
				{deck.scopeLabel ? (
					<span
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:truncate ep:max-w-[180px] ep:shrink-0"
						title={deck.scopeLabel}
					>
						{deck.scopeLabel}
					</span>
				) : null}
				{!isMobile() ? (
					<span class="ep:text-xs ep:text-obs-muted ep:truncate">
						{description}
					</span>
				) : null}
			</div>

			<span
				class={`ep:text-xs ep:font-medium ep:tabular-nums ep:shrink-0 ${count === 0 ? "ep:text-obs-faint" : "ep:text-obs-blue"}`}
			>
				{count === 0 ? "Empty" : `${count} card${count === 1 ? "" : "s"}`}
			</span>

			<div class="ep:flex ep:items-center ep:gap-0.5 ep:h-6 ep:shrink-0">
				<IconButton
					icon="play"
					customIcon={<PlayIcon />}
					ariaLabel={`Study ${title}`}
					disabled={count === 0}
					onClick={() => void plugin.startTemporaryCustomStudyDeck(deck.id)}
					size="small"
				/>
				<IconButton
					icon="refresh-cw"
					ariaLabel={`Rebuild ${title}`}
					onClick={() => void plugin.rebuildTemporaryCustomStudyDeck(deck.id)}
					size="small"
				/>
				<IconButton
					icon="eraser"
					ariaLabel={`Empty ${title}`}
					disabled={count === 0}
					onClick={() => void plugin.emptyTemporaryCustomStudyDeck(deck.id)}
					size="small"
				/>
				<IconButton
					icon="trash-2"
					ariaLabel={`Delete ${title}`}
					danger
					onClick={() => void handleDelete()}
					size="small"
				/>
			</div>
		</div>
	);
}
