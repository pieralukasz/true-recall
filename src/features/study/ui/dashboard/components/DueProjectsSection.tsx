import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import type { NoteAggregation } from "../DashboardApp";
import { useMemo } from "preact/hooks";

export function DueProjectsSection({
	notes,
}: {
	notes: NoteAggregation[];
}) {
	const plugin = usePlugin();

	const sortedNotes = useMemo(() => {
		return [...notes].sort((a, b) => {
			const aActive = a.due + a.newCount + a.learning;
			const bActive = b.due + b.newCount + b.learning;
			if (aActive > 0 && bActive === 0) return -1;
			if (aActive === 0 && bActive > 0) return 1;
			if (aActive > 0 && bActive > 0) return b.due - a.due;
			return a.name.localeCompare(b.name);
		});
	}, [notes]);

	if (sortedNotes.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4">
				No notes with flashcards yet.
			</div>
		);
	}

	return (
		<div>
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:pb-2 ep:mb-1 ep:border-b ep:border-obs-border">
				<span class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider">
					Due Now
				</span>
				<div class="ep:flex ep:gap-4 ep:text-[10px] ep:font-semibold ep:uppercase ep:tracking-wider ep:text-obs-muted">
					<span
						class="ep:w-8 ep:text-center"
						style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}
					>
						Due
					</span>
					<span
						class="ep:w-8 ep:text-center"
						style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}
					>
						New
					</span>
					<span
						class="ep:w-8 ep:text-center"
						style={{ color: `var(${FSRS_COLORS.learning.cssVar})` }}
					>
						Lrn
					</span>
				</div>
			</div>

			{/* Note rows */}
			<div class="ep:flex ep:flex-col">
				{sortedNotes.map((note) => {
					const hasActive =
						note.due > 0 || note.newCount > 0 || note.learning > 0;
					return (
						<Clickable
							key={note.name}
							class={[
								"ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:rounded ep:transition-all ep:duration-150 ep:hover:bg-obs-modifier-hover",
								hasActive ? "" : "ep:opacity-50",
							].join(" ")}
							style={{
								contentVisibility: "auto",
								containIntrinsicSize: "0 40px",
							}}
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
							<div class="ep:flex ep:gap-4 ep:shrink-0">
								<span
									class="ep:w-8 ep:text-center ep:text-xs ep:font-medium"
									style={
										note.due > 0
											? { color: `var(${FSRS_COLORS.review.cssVar})` }
											: undefined
									}
								>
									{note.due > 0 ? note.due : ""}
								</span>
								<span
									class="ep:w-8 ep:text-center ep:text-xs ep:font-medium"
									style={
										note.newCount > 0
											? { color: `var(${FSRS_COLORS.new.cssVar})` }
											: undefined
									}
								>
									{note.newCount > 0 ? note.newCount : ""}
								</span>
								<span
									class="ep:w-8 ep:text-center ep:text-xs ep:font-medium"
									style={
										note.learning > 0
											? { color: `var(${FSRS_COLORS.learning.cssVar})` }
											: undefined
									}
								>
									{note.learning > 0 ? note.learning : ""}
								</span>
							</div>
						</Clickable>
					);
				})}
			</div>
		</div>
	);
}
