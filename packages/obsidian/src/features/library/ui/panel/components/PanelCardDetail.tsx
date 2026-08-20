import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { assistantContextFromCard } from "@true-recall/obsidian/features/assistant/ui/ai-context-source";
import { openAiWorkspace } from "@true-recall/obsidian/features/assistant/ui/open-ai-workspace";
import { PanelCardFields } from "@true-recall/obsidian/features/library/ui/panel/components/PanelCardDetailContent";
import { PanelIconButton } from "@true-recall/obsidian/features/library/ui/panel/components/PanelIconButton";
import { usePanelCardMenu } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelCardMenu";
import type { PanelCardActionHandlers } from "@true-recall/obsidian/features/library/ui/panel/panel.types";
import { isCardPolishAvailable } from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";
import { getPanelCardStatus } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";
import { usePlugin } from "@true-recall/obsidian/preact";

interface PanelCardDetailProps {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	sourcePath: string;
	position: number;
	total: number;
	dayStartHour: number;
	onBack: () => void;
	onPrevious: () => void;
	onNext: () => void;
	actions: PanelCardActionHandlers;
}

export function PanelCardDetail({
	card,
	fsrsCard,
	sourcePath,
	position,
	total,
	dayStartHour,
	onBack,
	onPrevious,
	onNext,
	actions,
}: PanelCardDetailProps) {
	const plugin = usePlugin();
	const openMenu = usePanelCardMenu({
		card,
		fsrsCard,
		actions,
		variant: "detail",
	});
	const status = getPanelCardStatus(fsrsCard, dayStartHour);
	const canPolish = fsrsCard && isCardPolishAvailable(plugin.settings);

	const openPolishWorkspace = (event: MouseEvent) => {
		if (!fsrsCard) return;
		const anchor = event.currentTarget;
		openAiWorkspace(plugin, {
			intent: "preset",
			anchor: anchor instanceof HTMLElement ? anchor : undefined,
			mode: "card-polish",
			context: assistantContextFromCard(fsrsCard),
		});
	};

	return (
		<div class="tr-panel-detail ep:flex ep:h-full ep:min-h-0 ep:flex-col ep:bg-obs-primary">
			<header class="ep:flex ep:h-10 ep:shrink-0 ep:items-center ep:gap-1 ep:border-b ep:border-obs-border ep:px-1">
				<PanelIconButton
					icon="arrow-left"
					label="Back to Cards (Esc)"
					onClick={onBack}
				/>
				<div class="ep:flex ep:min-w-0 ep:flex-1 ep:items-center ep:justify-center ep:gap-2 ep:text-center ep:text-ui-smaller ep:text-obs-muted ep:tabular-nums">
					<span>
						{position} of {total}
					</span>
					{status ? (
						<span
							class="tr-panel-detail-status-dot"
							data-tone={status.tone}
							role="img"
							aria-label={status.label}
							title={status.label}
						/>
					) : null}
				</div>
				<PanelIconButton
					icon="chevron-up"
					label="Previous Card (K or ↑)"
					disabled={total <= 1}
					onClick={onPrevious}
				/>
				<PanelIconButton
					icon="chevron-down"
					label="Next Card (J or ↓)"
					disabled={total <= 1}
					onClick={onNext}
				/>
				{canPolish ? (
					<PanelIconButton
						icon="wand"
						label="Polish Card (AI)"
						onClick={openPolishWorkspace}
					/>
				) : null}
				<PanelIconButton
					icon="more-vertical"
					label="Card Actions"
					onClick={openMenu}
				/>
			</header>

			<div class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto ep:overscroll-contain">
				<PanelCardFields
					card={card}
					fsrsCard={fsrsCard}
					sourcePath={sourcePath}
					actions={actions}
				/>
			</div>
		</div>
	);
}
