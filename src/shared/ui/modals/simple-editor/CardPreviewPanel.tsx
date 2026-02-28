import type { FlashcardItem } from "@shared/types";
import { cn } from "@shared/ui/utils/cn";
import { Clickable } from "@shared/ui/components";
import { useState } from "preact/hooks";

export interface CardPreviewPanelProps {
	cards: FlashcardItem[];
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
	cloze: { label: "cloze", cls: "ep:bg-obs-orange/15 ep:text-obs-orange" },
	reversed: { label: "reversed", cls: "ep:bg-obs-blue/15 ep:text-obs-blue" },
};

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return text.slice(0, maxLen).trimEnd() + "...";
}

export function CardPreviewPanel({ cards }: CardPreviewPanelProps) {
	const [expanded, setExpanded] = useState(false);

	// Collapsed state: thin vertical strip
	if (!expanded) {
		return (
			<Clickable
				class={cn(
					"ep:flex ep:flex-col ep:items-center ep:justify-center ep:gap-2",
					"ep:w-8 ep:shrink-0 ep:self-stretch",
					"ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-secondary/30",
					"ep:hover:bg-obs-modifier-hover ep:transition-colors ep:cursor-pointer",
				)}
				onClick={() => setExpanded(true)}
				role="button"
				aria-label="Show card preview"
			>
				{cards.length > 0 && (
					<span class="ep:text-[10px] ep:font-medium ep:px-1 ep:py-0.5 ep:rounded-full ep:bg-obs-interactive/15 ep:text-obs-interactive">
						{cards.length}
					</span>
				)}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="ep:text-obs-muted"
				>
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</Clickable>
		);
	}

	// Expanded state: side panel
	return (
		<div class="ep:w-[280px] ep:shrink-0 ep:flex ep:flex-col ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-secondary/30 ep:overflow-hidden">
			{/* Header */}
			<Clickable
				class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:bg-transparent ep:hover:bg-obs-modifier-hover ep:transition-colors ep:shrink-0"
				onClick={() => setExpanded(false)}
				stopPropagation={false}
			>
				<span class="ep:flex ep:items-center ep:gap-1.5 ep:text-ui-small ep:text-obs-muted">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="15 18 9 12 15 6" />
					</svg>
					Preview
				</span>
				{cards.length > 0 && (
					<span class="ep:text-ui-smaller ep:font-medium ep:px-2 ep:py-0.5 ep:rounded-full ep:bg-obs-interactive/15 ep:text-obs-interactive">
						{cards.length}
					</span>
				)}
			</Clickable>

			{/* Card list */}
			<div class="ep:border-t ep:border-obs-border ep:flex-1 ep:overflow-y-auto">
				{cards.length === 0 ? (
					<div class="ep:px-3 ep:py-3 ep:text-ui-smaller ep:text-obs-faint">
						No cards detected.
					</div>
				) : (
					cards.map((card, i) => {
						const badge = card.cardType
							? TYPE_BADGE[card.cardType]
							: null;

						return (
							<div
								key={card.id}
								class={cn(
									"ep:px-3 ep:py-2 ep:text-ui-smaller",
									i > 0 && "ep:border-t ep:border-obs-border/50",
								)}
							>
								<div class="ep:flex ep:items-start ep:gap-2">
									<span class="ep:text-obs-faint ep:shrink-0 ep:w-5 ep:text-right">
										{i + 1}.
									</span>
									<div class="ep:flex-1 ep:min-w-0">
										<div class="ep:flex ep:items-center ep:gap-1.5">
											{badge && (
												<span
													class={cn(
														"ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded ep:uppercase ep:font-medium ep:shrink-0",
														badge.cls,
													)}
												>
													{badge.label}
												</span>
											)}
											<span class="ep:text-obs-normal ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
												{truncate(card.question, 60)}
											</span>
										</div>
										{card.answer && (
											<div class="ep:text-obs-muted ep:mt-0.5 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
												{truncate(card.answer, 80)}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
