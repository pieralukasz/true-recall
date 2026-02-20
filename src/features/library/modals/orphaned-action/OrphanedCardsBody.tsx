import type { TFile } from "obsidian";
import { useCallback, useState } from "preact/hooks";
import type { FSRSCardData } from "@shared/types";
import { NotePicker } from "@shared/ui/components/NotePicker";
import type { OrphanedCardsActionResult } from "@features/library/modals/orphaned-action/types";
import { CardPreview } from "@features/library/modals/orphaned-action/CardPreview";
import { OrphanedActionButton } from "@features/library/modals/orphaned-action/OrphanedActionButton";

export interface OrphanedCardsBodyProps {
	cards: FSRSCardData[];
	deletedNoteName: string;
	allNotes: TFile[];
	onResolve: (result: OrphanedCardsActionResult) => void;
	onCreateNote: () => void;
}

export function OrphanedCardsBody({
	cards,
	deletedNoteName,
	allNotes,
	onResolve,
	onCreateNote,
}: OrphanedCardsBodyProps) {
	const [showMoveSection, setShowMoveSection] = useState(false);

	const handleDelete = useCallback(() => {
		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		const confirmed = window.confirm(
			`Are you sure you want to delete ${cards.length} flashcard${cards.length === 1 ? "" : "s"}? This cannot be undone.`,
		);
		if (confirmed) {
			onResolve({ cancelled: false, action: "delete" });
		}
	}, [cards.length, onResolve]);

	return (
		<>
			<p class="ep:text-obs-normal ep:text-ui-small ep:mb-4">
				The note "{deletedNoteName}" was deleted. What would you like to do with
				its {cards.length} flashcard{cards.length === 1 ? "" : "s"}?
			</p>

			<CardPreview cards={cards} />

			<div class="ep:flex ep:flex-col ep:gap-2">
				<OrphanedActionButton
					icon="trash-2"
					label="Delete cards"
					description="Permanently remove these flashcards"
					type="danger"
					onClick={handleDelete}
				/>
				<OrphanedActionButton
					icon="folder"
					label="Move to another note"
					description="Transfer cards to an existing note"
					type="secondary"
					onClick={() => setShowMoveSection(true)}
				/>
				<OrphanedActionButton
					icon="file-plus"
					label="Create new note"
					description="Create a note with these cards"
					type="secondary"
					onClick={onCreateNote}
				/>
				<button
					type="button"
					class="ep:w-full ep:py-2 ep:px-3 ep:rounded-md ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:mt-2"
					onClick={() =>
						onResolve({ cancelled: false, action: "leave_orphaned" })
					}
				>
					Leave as orphaned (can manage later in settings)
				</button>
			</div>

			{showMoveSection && (
				<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
					<NotePicker
						notes={allNotes}
						onSelect={(note) =>
							onResolve({
								cancelled: false,
								action: "move",
								targetNotePath: note.path,
							})
						}
						onCancel={() => setShowMoveSection(false)}
						maxResults={30}
						title="Select target note"
					/>
				</div>
			)}
		</>
	);
}
