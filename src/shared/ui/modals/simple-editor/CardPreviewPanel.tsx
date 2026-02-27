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
	const [expanded, setExpanded] = useState(true);

	if (cards.length === 0) {
		return (
			<div class="ep:mt-3 ep:px-3 ep:py-2.5 ep:rounded-md ep:bg-obs-secondary/50 ep:text-ui-smaller ep:text-obs-faint">
				No cards detected. Write content using one of the supported formats.
			</div>
		);
	}

	return (
		<div class="ep:mt-3 ep:rounded-md ep:border ep:border-obs-border ep:bg-obs-secondary/30 ep:overflow-hidden">
			<Clickable
				class="ep:w-full ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:bg-transparent ep:hover:bg-obs-modifier-hover ep:transition-colors"
				onClick={() => setExpanded(!expanded)}
				stopPropagation={false}
			>
				<span class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small ep:text-obs-muted">
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class={cn(
							"ep:transition-transform",
							expanded && "ep:rotate-90",
						)}
					>
						<polyline points="9 18 15 12 9 6" />
					</svg>
					Preview
				</span>
				<span class="ep:text-ui-smaller ep:font-medium ep:px-2 ep:py-0.5 ep:rounded-full ep:bg-obs-interactive/15 ep:text-obs-interactive">
					{cards.length} {cards.length === 1 ? "card" : "cards"}
				</span>
			</Clickable>

			{expanded && (
				<div class="ep:border-t ep:border-obs-border ep:max-h-[200px] ep:overflow-y-auto">
					{cards.map((card, i) => {
						const badge = card.cardType
							? TYPE_BADGE[card.cardType]
							: null;

						return (
							<div
								key={card.id}
								class={cn(
									"ep:px-3 ep:py-2 ep:text-ui-smaller",
									i > 0 &&
										"ep:border-t ep:border-obs-border/50",
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
												{truncate(card.question, 80)}
											</span>
										</div>
										{card.answer && (
											<div class="ep:text-obs-muted ep:mt-0.5 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
												{truncate(card.answer, 100)}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
