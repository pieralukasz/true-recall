import { FSRS_COLORS, MUTED_STATES } from "@shared/ui/helpers/fsrs-colors";
import { stripMarkdownSyntax } from "@shared/utils";
import { State } from "ts-fsrs";
import type { BrowserCard } from "../types";

const STATE_BADGE: Record<string, { cls: string; label: string }> = {
	[State.New]: { cls: FSRS_COLORS.new.badgeCls, label: "New" },
	[State.Learning]: { cls: FSRS_COLORS.learning.badgeCls, label: "Lrn" },
	[State.Review]: { cls: FSRS_COLORS.review.badgeCls, label: "Rev" },
	[State.Relearning]: {
		cls: FSRS_COLORS.relearning.badgeCls,
		label: "ReLrn",
	},
	suspended: { cls: FSRS_COLORS.suspended.badgeCls, label: "Sus" },
	buried: { cls: MUTED_STATES.buried.badgeCls, label: "Buried" },
};

interface CardGridProps {
	cards: BrowserCard[];
	selectedIds: Set<string>;
	onSelect: (
		cardId: string,
		event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
	) => void;
	onPreview: (card: BrowserCard) => void;
}

export function CardGrid({
	cards,
	selectedIds,
	onSelect,
	onPreview,
}: CardGridProps) {
	if (cards.length === 0) {
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:py-12 ep:text-obs-muted ep:text-sm">
				No cards match your filters
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5 ep:p-2 ep:overflow-y-auto">
			{cards.map((card) => {
				const badgeKey = card.suspended
					? "suspended"
					: card.buriedUntil &&
						  new Date(card.buriedUntil) > new Date()
						? "buried"
						: String(card.state);
				const badge = STATE_BADGE[badgeKey] ?? {
					cls: MUTED_STATES.unknown.badgeCls,
					label: "?",
				};
				const selected = selectedIds.has(card.id);

				return (
					<div
						key={card.id}
						class={`ep:p-3 ep:rounded-lg ep:border ep:border-obs-border ep:cursor-pointer ep:transition-colors ${
							selected
								? "ep:bg-obs-interactive/10 ep:border-obs-interactive/30"
								: "hover:ep:bg-obs-modifier-hover"
						}`}
						onClick={() => onPreview(card)}
						onContextMenu={(e) => {
							e.preventDefault();
							onSelect(card.id, { ctrlKey: true });
						}}
					>
						<div class="ep:flex ep:items-start ep:justify-between ep:gap-2 ep:mb-1.5">
							<span class="ep:text-sm ep:text-obs-normal ep:line-clamp-2 ep:flex-1">
								{stripMarkdownSyntax(card.question)}
							</span>
							<span
								class={`ep:px-1.5 ep:py-0.5 ep:rounded-full ep:text-[10px] ep:font-medium ep:shrink-0 ${badge.cls}`}
							>
								{badge.label}
							</span>
						</div>

						<div class="ep:flex ep:items-center ep:gap-2 ep:text-[11px] ep:text-obs-muted">
							{card.sourceNoteName && (
								<span class="ep:truncate ep:max-w-[120px]">
									{card.sourceNoteName}
								</span>
							)}
							{card.sourceNoteName && (
								<span class="ep:opacity-30">&middot;</span>
							)}
							<span>{card.reps} reps</span>
							{card.lapses > 0 && (
								<>
									<span class="ep:opacity-30">&middot;</span>
									<span class="ep:text-obs-error">
										{card.lapses} lapses
									</span>
								</>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
