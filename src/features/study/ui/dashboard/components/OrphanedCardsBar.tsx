import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import type { OrphanedCardStats } from "../types";

interface OrphanedCardsBarProps {
	stats: OrphanedCardStats;
}

export function OrphanedCardsBar({ stats }: OrphanedCardsBarProps) {
	const plugin = usePlugin();

	if (stats.total === 0) return null;

	const handleView = () => {
		void plugin.openCardBrowser({ orphaned: true });
	};

	return (
		<div class="ep:flex ep:items-center ep:gap-3 ep:px-3 ep:py-2 ep:rounded-lg ep:border ep:border-obs-error/20 ep:bg-obs-error/5">
			<div class="ep:flex-1 ep:min-w-0 ep:flex ep:items-center ep:gap-2">
				<span class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted">
					{stats.total} orphaned card{stats.total !== 1 ? "s" : ""}
				</span>
				<CardCountDisplay
					newCount={stats.new}
					learningCount={stats.learning}
					dueCount={stats.due}
				/>
			</div>
			<Clickable
				class="ep:shrink-0 ep:px-2.5 ep:py-1 ep:rounded-md ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:bg-obs-modifier-hover/50 ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors"
				onClick={handleView}
			>
				View
			</Clickable>
		</div>
	);
}
