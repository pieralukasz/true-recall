import type {
	CustomStudyRequest,
	TemporaryCustomStudyDeck,
} from "@true-recall/core/types";

import { ActionButton } from "@true-recall/obsidian/components";
import { confirm } from "@true-recall/obsidian/modals/shared";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

function describeRequest(request: CustomStudyRequest): string {
	switch (request.kind) {
		case "increase-new":
			return `${request.amount} additional new card${request.amount === 1 ? "" : "s"}`;
		case "increase-review":
			return `${request.amount} additional review card${request.amount === 1 ? "" : "s"}`;
		case "forgotten":
			return `Cards forgotten in the last ${request.days} day${request.days === 1 ? "" : "s"}`;
		case "review-ahead":
			return `Reviews due in the next ${request.days} day${request.days === 1 ? "" : "s"}`;
		case "preview-new":
			return `New cards added in the last ${request.days} day${request.days === 1 ? "" : "s"}`;
		case "state-or-tag": {
			const state =
				request.cardState === "all"
					? "All cards"
					: `${request.cardState} cards`;
			return `${state} · limit ${request.cardLimit}`;
		}
	}
}

export function TemporaryCustomStudyDeckCard({
	deck,
}: {
	deck: TemporaryCustomStudyDeck;
}) {
	const plugin = usePlugin();
	const deckIcon = useIcon("layers-3");
	const count = deck.cardIds.length;

	const handleDelete = async () => {
		const confirmed = await confirm(plugin.app, {
			title: "Delete Custom Study Session?",
			message:
				"The temporary deck will be removed. Its flashcards will not be deleted.",
			confirmLabel: "Delete deck",
		});
		if (confirmed) await plugin.deleteTemporaryCustomStudyDeck();
	};

	return (
		<section class="tr-custom-study-deck ep:rounded-lg ep:border ep:border-obs-blue/30 ep:bg-obs-blue/10 ep:shadow-raised ep:p-4">
			<div class="tr-custom-study-deck__layout">
				<div class="tr-custom-study-deck__summary ep:flex ep:items-start ep:gap-3 ep:min-w-0">
					<div
						ref={deckIcon}
						class="ep:shrink-0 ep:w-9 ep:h-9 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:bg-obs-blue/15 ep:text-obs-blue ep:[&_svg]:w-5 ep:[&_svg]:h-5"
					/>
					<div class="ep:min-w-0">
						<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-2">
							<h2 class="ep:text-base ep:font-semibold ep:text-obs-normal ep:m-0">
								{deck.name}
							</h2>
							<span class="ep:px-2 ep:py-0.5 ep:rounded-full ep:bg-obs-blue/15 ep:text-obs-blue ep:text-ui-smaller ep:font-medium">
								Temporary deck
							</span>
						</div>
						<p class="ep:text-sm ep:text-obs-muted ep:mt-1 ep:mb-0">
							{describeRequest(deck.customStudy)}
							{deck.scopeLabel ? ` · ${deck.scopeLabel}` : ""}
						</p>
						<p class="ep:text-ui-small ep:text-obs-blue ep:mt-1 ep:mb-0 ep:font-medium">
							{count === 0
								? "Empty — rebuild to fetch matching cards"
								: `${count} card${count === 1 ? "" : "s"} remaining`}
						</p>
					</div>
				</div>

				<div class="tr-custom-study-deck__actions ep:flex ep:flex-wrap ep:items-center ep:gap-2">
					<ActionButton
						label="Study"
						icon="play"
						variant="primary"
						disabled={count === 0}
						onClick={() => void plugin.startTemporaryCustomStudyDeck()}
					/>
					<ActionButton
						label="Rebuild"
						icon="refresh-cw"
						variant="secondary"
						onClick={() => void plugin.rebuildTemporaryCustomStudyDeck()}
					/>
					<ActionButton
						label="Empty"
						variant="ghost"
						disabled={count === 0}
						onClick={() => void plugin.emptyTemporaryCustomStudyDeck()}
					/>
					<ActionButton
						label="Delete"
						icon="trash-2"
						variant="ghost"
						onClick={() => void handleDelete()}
					/>
				</div>
			</div>
		</section>
	);
}
