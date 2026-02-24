import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import type { NoteAggregation } from "../DashboardApp";

export function DueProjectsSection({
	notes,
}: {
	notes: NoteAggregation[];
}) {
	const plugin = usePlugin();

	const dueNotes = notes
		.filter((n) => n.due > 0)
		.sort((a, b) => b.due - a.due)
		.slice(0, 10);

	if (dueNotes.length === 0) return null;

	return (
		<div class="ep:mb-4">
			<div class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider ep:mb-2">
				Due Now
			</div>
			<div class="ep:flex ep:flex-col ep:gap-1.5">
				{dueNotes.map((note) => (
					<Clickable
						key={note.name}
						class="ep:flex ep:items-center ep:justify-between ep:p-3 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200 ep:hover:bg-obs-modifier-hover"
						onClick={() => {
							void plugin.openReviewViewWithFilters({
								sourceNoteFilter: note.name,
								ignoreDailyLimits: true,
							});
						}}
					>
						<span class="ep:text-sm ep:text-obs-normal ep:truncate ep:mr-3 ep:flex-1">
							{note.name}
						</span>
						<div class="ep:flex ep:gap-1.5 ep:shrink-0">
							{note.due > 0 && (
								<span
									class="ep:text-xs ep:px-1.5 ep:py-0.5 ep:rounded"
									style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}
								>
									{note.due}
								</span>
							)}
							{note.newCount > 0 && (
								<span
									class="ep:text-xs ep:px-1.5 ep:py-0.5 ep:rounded"
									style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}
								>
									{note.newCount}
								</span>
							)}
							{note.learning > 0 && (
								<span
									class="ep:text-xs ep:px-1.5 ep:py-0.5 ep:rounded"
									style={{ color: `var(${FSRS_COLORS.learning.cssVar})` }}
								>
									{note.learning}
								</span>
							)}
						</div>
					</Clickable>
				))}
			</div>
		</div>
	);
}
