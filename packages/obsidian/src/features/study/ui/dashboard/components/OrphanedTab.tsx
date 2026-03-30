import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import type { OrphanedCardStats } from "../types";

interface OrphanedTabProps {
	stats: OrphanedCardStats;
}

export function OrphanedTab({ stats }: OrphanedTabProps) {
	const plugin = usePlugin();

	const handleViewInBrowser = () => {
		void plugin.openCardBrowser({ orphaned: true });
	};

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:gap-4 ep:py-10 ep:text-center">
			<div class="ep:text-4xl ep:font-bold ep:text-obs-normal ep:tabular-nums">
				{stats.total}
			</div>
			<div class="ep:text-sm ep:text-obs-muted">
				orphaned card{stats.total !== 1 ? "s" : ""} with no matching source note
			</div>

			<CardCountDisplay
				newCount={stats.new}
				learningCount={stats.learning}
				dueCount={stats.due}
				size="small"
			/>

			<Clickable
				class="ep:mt-2 ep:px-4 ep:py-2 ep:rounded-md ep:text-sm ep:font-medium ep:bg-obs-interactive/15 ep:text-obs-interactive ep:hover:bg-obs-interactive/25 ep:transition-colors"
				onClick={handleViewInBrowser}
			>
				View in Card Browser
			</Clickable>
		</div>
	);
}
