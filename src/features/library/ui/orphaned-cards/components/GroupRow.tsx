import { useState } from "preact/hooks";
import type { OrphanedCardGroup } from "../../../services/orphaned-cards.service";

export interface GroupRowProps {
	group: OrphanedCardGroup;
	onDelete: (group: OrphanedCardGroup) => void;
	onCreateNote: (group: OrphanedCardGroup) => void;
	onMove: (group: OrphanedCardGroup) => void;
}

export function GroupRow({ group, onDelete, onCreateNote, onMove }: GroupRowProps) {
	const [expanded, setExpanded] = useState(false);
	const icon = group.reason === "no_source_uid" ? "❓" : "🗑️";
	const maxPreview = 5;

	return (
		<div class="ep:border-b ep:border-obs-border ep:last:border-b-0">
			{/* Group header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:p-3 ep:bg-obs-secondary">
				<button
					type="button"
					class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:flex ep:items-center ep:gap-3 ep:flex-1 ep:hover:opacity-80"
					onClick={() => setExpanded((v) => !v)}
				>
					<span class="ep:text-lg">{icon}</span>
					<div>
						<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
							{group.displayName}
						</div>
						<div class="ep:text-ui-smaller ep:text-obs-muted">
							{group.cards.length} card{group.cards.length === 1 ? "" : "s"}
						</div>
					</div>
				</button>

				<div class="ep:flex ep:items-center ep:gap-2">
					<button
						type="button"
						class="ep:py-1 ep:px-2 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-smaller ep:cursor-pointer ep:hover:opacity-80 ep:border-none"
						onClick={() => onMove(group)}
					>
						Move
					</button>
					<button
						type="button"
						class="ep:py-1 ep:px-2 ep:rounded-md ep:bg-obs-secondary ep:text-obs-normal ep:text-ui-smaller ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:border ep:border-obs-border"
						onClick={() => onCreateNote(group)}
					>
						Create note
					</button>
					<button
						type="button"
						class="ep:py-1 ep:px-2 ep:rounded-md ep:bg-obs-red ep:text-obs-on-accent ep:text-ui-smaller ep:cursor-pointer ep:hover:opacity-90 ep:border-none"
						onClick={() => onDelete(group)}
					>
						Delete
					</button>
				</div>
			</div>

			{/* Expandable card preview */}
			{expanded && (
				<div class="ep:pl-8 ep:pr-3 ep:pb-2">
					{group.cards.slice(0, maxPreview).map((card) => (
						<div
							key={card.id}
							class="ep:py-2 ep:border-b ep:border-obs-border ep:last:border-b-0"
						>
							<div class="ep:text-ui-smaller ep:text-obs-normal">
								Q:{" "}
								{card.question.length > 100
									? `${card.question.slice(0, 100)}...`
									: card.question}
							</div>
						</div>
					))}
					{group.cards.length > maxPreview && (
						<div class="ep:text-ui-smaller ep:text-obs-muted ep:pt-2">
							... and {group.cards.length - maxPreview} more
						</div>
					)}
				</div>
			)}
		</div>
	);
}
