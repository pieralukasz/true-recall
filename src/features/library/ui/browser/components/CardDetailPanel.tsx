import {
	formatDueDate,
	formatIntervalDays,
} from "@features/library/ui/browser/helpers/browser-helpers";
import type { FSRSFlashcardItem } from "@shared/types";
import { IconButton, StateBadge } from "@shared/ui/components";
import { useMarkdown } from "@shared/ui/preact/hooks";
import { Fragment } from "preact";
import { useMemo } from "preact/hooks";

export interface CardDetailPanelProps {
	card: FSRSFlashcardItem;
	onClose: () => void;
	onOpenSource: (path: string) => void;
	onSuspend: (cardId: string) => void;
	onUnsuspend: (cardId: string) => void;
	onDelete: (cardId: string) => void;
	onReset: (cardId: string) => void;
}

export function CardDetailPanel({
	card,
	onClose,
	onOpenSource,
	onSuspend,
	onUnsuspend,
	onDelete,
	onReset,
}: CardDetailPanelProps) {
	const questionRef = useMarkdown(card.question);
	const answerRef = useMarkdown(card.answer);

	const fields: [string, string][] = useMemo(
		() => [
			["Due", formatDueDate(card.fsrs.due)],
			["Interval", formatIntervalDays(card.fsrs.scheduledDays)],
			[
				"Stability",
				card.fsrs.stability > 0 ? `${card.fsrs.stability.toFixed(1)}d` : "-",
			],
			["Difficulty", card.fsrs.difficulty.toFixed(1)],
			["Lapses", String(card.fsrs.lapses)],
			["Reps", String(card.fsrs.reps)],
			[
				"Created",
				card.fsrs.createdAt
					? new Date(card.fsrs.createdAt).toLocaleDateString()
					: "-",
			],
			[
				"Last review",
				card.fsrs.lastReview
					? new Date(card.fsrs.lastReview).toLocaleDateString()
					: "-",
			],
			["Projects", card.projects.length > 0 ? card.projects.join(", ") : "-"],
		],
		[card],
	);

	return (
		<div class="ep:border-t ep:border-obs-border ep:bg-obs-primary ep:flex ep:flex-col ep:h-[220px] ep:shrink-0">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:border-b ep:border-obs-border ep:shrink-0">
				<IconButton icon="x" ariaLabel="Close preview" onClick={onClose} />

				<StateBadge
					state={card.fsrs.state}
					suspended={card.fsrs.suspended}
					buriedUntil={card.fsrs.buriedUntil}
					size="sm"
				/>

				{card.cardType && card.cardType !== "basic" && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:uppercase">
						{card.cardType}
					</span>
				)}

				<div class="ep:flex-1" />

				{card.sourceNoteName && card.sourceNotePath && (
					<button
						type="button"
						class="ep:text-ui-smaller ep:text-obs-accent ep:hover:underline ep:cursor-pointer ep:truncate ep:max-w-[200px] ep:bg-transparent ep:border-none ep:p-0"
						onClick={() => {
							if (card.sourceNotePath) onOpenSource(card.sourceNotePath);
						}}
					>
						{card.sourceNoteName}
					</button>
				)}

				<div class="ep:flex ep:items-center ep:gap-1">
					{card.fsrs.suspended ? (
						<IconButton
							icon="play"
							ariaLabel="Unsuspend"
							onClick={() => onUnsuspend(card.id)}
						/>
					) : (
						<IconButton
							icon="pause"
							ariaLabel="Suspend"
							onClick={() => onSuspend(card.id)}
						/>
					)}
					<IconButton
						icon="rotate-ccw"
						ariaLabel="Reset"
						onClick={() => onReset(card.id)}
					/>
					<IconButton
						icon="trash-2"
						ariaLabel="Delete"
						danger
						onClick={() => onDelete(card.id)}
					/>
				</div>
			</div>

			{/* Content */}
			<div class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
				<div class="ep:grid ep:grid-cols-[1fr_1fr] ep:gap-0 ep:h-full">
					{/* Left: Q & A */}
					<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border-r ep:border-obs-border ep:overflow-y-auto">
						<div>
							<div class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:mb-1">
								Q:
							</div>
							<div
								class="ep:text-ui-small ep:text-obs-normal"
								ref={questionRef}
							/>
						</div>
						<div>
							<div class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:mb-1">
								A:
							</div>
							<div
								class="ep:text-ui-small ep:text-obs-normal"
								ref={answerRef}
							/>
						</div>
					</div>

					{/* Right: Metadata */}
					<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:p-3 ep:content-start ep:overflow-y-auto">
						{fields.map(([label, value]) => (
							<Fragment key={label}>
								<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
									{label}
								</span>
								<span class="ep:text-ui-smaller ep:text-obs-normal">
									{value}
								</span>
							</Fragment>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
