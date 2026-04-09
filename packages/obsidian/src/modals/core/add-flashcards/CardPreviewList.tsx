import { useState } from "preact/hooks";

import type { ParsedCard } from "@true-recall/core/flashcard/parsing/bulk-card-parser";
import { BUILTIN_CLOZE_ID } from "@true-recall/core/types/note.types";

import { Clickable } from "@true-recall/obsidian/components";

const COLLAPSED_COUNT = 5;

interface CardPreviewListProps {
	cards: ParsedCard[];
	duplicateCount?: number;
}

export function CardPreviewList({
	cards,
	duplicateCount = 0,
}: CardPreviewListProps) {
	const [expanded, setExpanded] = useState(false);

	if (cards.length === 0) return null;

	const basicCount = cards.filter(
		(c) => c.noteTypeId !== BUILTIN_CLOZE_ID,
	).length;
	const clozeCount = cards.filter(
		(c) => c.noteTypeId === BUILTIN_CLOZE_ID,
	).length;

	const shown = expanded ? cards : cards.slice(0, COLLAPSED_COUNT);
	const hiddenCount = cards.length - COLLAPSED_COUNT;

	return (
		<div class="ep:space-y-2">
			<div class="ep:text-ui-smaller ep:text-obs-muted">
				Detected: {cards.length} card{cards.length !== 1 ? "s" : ""}
				{clozeCount > 0 && basicCount > 0 && (
					<span>
						{" "}
						({basicCount} Basic, {clozeCount} Cloze)
					</span>
				)}
				{duplicateCount > 0 && (
					<span class="ep:text-obs-faint">
						{" "}
						· {duplicateCount} duplicate{duplicateCount !== 1 ? "s" : ""}{" "}
						removed
					</span>
				)}
			</div>
			<div class="ep:max-h-[200px] ep:overflow-y-auto ep:space-y-1">
				{shown.map((card, i) => (
					<CardPreviewItem
						key={`card-${i}-${Object.values(card.fields)[0]?.slice(0, 30) ?? i}`}
						card={card}
						index={i}
					/>
				))}
				{hiddenCount > 0 && !expanded && (
					<Clickable
						class="ep:text-ui-smaller ep:text-obs-faint ep:hover:text-obs-muted ep:px-2 ep:py-1"
						onClick={() => setExpanded(true)}
					>
						+{hiddenCount} more card{hiddenCount !== 1 ? "s" : ""}
					</Clickable>
				)}
			</div>
		</div>
	);
}

function CardPreviewItem({ card, index }: { card: ParsedCard; index: number }) {
	const isCloze = card.noteTypeId === BUILTIN_CLOZE_ID;
	const fieldEntries = Object.entries(card.fields);
	const isMultiField = fieldEntries.length > 2;

	return (
		<div class="ep:flex ep:items-start ep:gap-2 ep:px-2 ep:py-1.5 ep:bg-obs-secondary ep:rounded ep:text-ui-smaller">
			<span class="ep:text-obs-faint ep:shrink-0 ep:tabular-nums ep:w-5 ep:text-right">
				{index + 1}.
			</span>
			<div class="ep:flex-1 ep:min-w-0">
				{isCloze ? (
					<span class="ep:text-obs-normal ep:line-clamp-2">
						{card.fields.Text}
					</span>
				) : isMultiField ? (
					<div class="ep:flex ep:flex-wrap ep:gap-x-3 ep:gap-y-0.5">
						{fieldEntries.map(([key, value]) => (
							<span key={key} class="ep:line-clamp-1">
								<span class="ep:text-obs-faint">{key}: </span>
								<span class="ep:text-obs-normal">{value}</span>
							</span>
						))}
					</div>
				) : (
					<span class="ep:text-obs-normal ep:line-clamp-1">
						{fieldEntries[0]?.[1]}
						<span class="ep:text-obs-faint ep:mx-1">&rarr;</span>
						{fieldEntries[1]?.[1]}
					</span>
				)}
			</div>
			{isCloze && (
				<span class="ep:shrink-0 ep:px-1 ep:py-0.5 ep:text-[10px] ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded">
					Cloze
				</span>
			)}
		</div>
	);
}
