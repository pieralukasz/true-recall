import { Clickable } from "@shared/ui/components/Clickable";
import { usePlugin } from "@shared/ui/preact";
import type { DashboardNoteEntry, NotePriority } from "../types";

const PRIORITY_BG: Record<NotePriority, string> = {
	overdue: "ep:bg-obs-red/10",
	hot: "ep:bg-obs-orange/10",
	due: "ep:bg-obs-blue/10",
	light: "ep:bg-obs-green/10",
	done: "ep:bg-obs-modifier-hover",
};

interface RecentlyStudiedBarProps {
	notes: DashboardNoteEntry[];
}

export function RecentlyStudiedBar({ notes }: RecentlyStudiedBarProps) {
	const plugin = usePlugin();

	if (notes.length === 0) return null;

	const handleClick = (note: DashboardNoteEntry) => {
		if (note.priority === "done" && note.path) {
			void plugin.app.workspace.openLinkText(note.name, "");
		} else {
			void plugin.openReviewViewWithFilters({
				sourceNoteFilter: note.name,
				ignoreDailyLimits: true,
			});
		}
	};

	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:px-1 ep:overflow-hidden">
			<span class="ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider ep:shrink-0">
				Recently Studied
			</span>
			<div class="ep:flex ep:items-center ep:gap-1.5 ep:overflow-x-auto ep:min-w-0">
				{notes.map((note) => (
					<Clickable
						key={note.name}
						class={`ep:shrink-0 ep:px-2.5 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:rounded-full ${PRIORITY_BG[note.priority]} ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors ep:truncate ep:max-w-[180px]`}
						onClick={() => handleClick(note)}
					>
						{note.name}
					</Clickable>
				))}
			</div>
		</div>
	);
}
