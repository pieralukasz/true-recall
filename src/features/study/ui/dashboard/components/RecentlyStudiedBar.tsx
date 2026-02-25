import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import type { DashboardNoteEntry } from "../types";

interface RecentlyStudiedBarProps {
	notes: DashboardNoteEntry[];
}

export function RecentlyStudiedBar({ notes }: RecentlyStudiedBarProps) {
	const plugin = usePlugin();

	if (notes.length === 0) return null;

	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:px-1 ep:overflow-hidden">
			<span class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider ep:shrink-0">
				Recently Studied
			</span>
			<div class="ep:flex ep:items-center ep:gap-1.5 ep:overflow-x-auto ep:min-w-0">
				{notes.map((note) => (
					<Clickable
						key={note.name}
						class="ep:shrink-0 ep:px-2.5 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:rounded-full ep:bg-obs-secondary ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors ep:truncate ep:max-w-[180px]"
						onClick={() => {
							void plugin.openReviewViewWithFilters({
								sourceNoteFilter: note.name,
								ignoreDailyLimits: true,
							});
						}}
					>
						{note.name}
					</Clickable>
				))}
			</div>
		</div>
	);
}
