import { useSignal } from "@preact/signals";
import { Clickable } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact/hooks";
import { usePlugin } from "@shared/ui/preact";
import type { DashboardNoteEntry } from "../types";
import { getTimeAgo } from "../helpers/time-ago";
import { useMemo } from "preact/hooks";

const MAX_VISIBLE = 10;

export function RecentlyStudiedSection({
	notes,
}: {
	notes: DashboardNoteEntry[];
}) {
	const plugin = usePlugin();
	const isCollapsed = useSignal(true);
	const chevronRef = useIcon(
		isCollapsed.value ? "chevron-right" : "chevron-down",
	);

	const recentNotes = useMemo(() => {
		return [...notes]
			.filter((n) => n.lastReview)
			.sort((a, b) => b.lastReview!.localeCompare(a.lastReview!))
			.slice(0, MAX_VISIBLE);
	}, [notes]);

	if (recentNotes.length === 0) return null;

	const mostRecent = recentNotes[0];

	const openNote = (note: DashboardNoteEntry) => {
		if (!note.path) return;
		const file = plugin.app.vault.getAbstractFileByPath(note.path);
		if (file) {
			void plugin.app.workspace
				.getLeaf(false)
				.openFile(file as import("obsidian").TFile);
		}
	};

	return (
		<div class="ep:border-t ep:border-obs-border ep:pt-3">
			{/* Header row: toggle + continue shortcut */}
			<div class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:mb-2">
				<Clickable
					class="ep:flex ep:items-center ep:gap-1.5 ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider ep:hover:text-obs-normal ep:transition-colors"
					aria-expanded={!isCollapsed.value}
					onClick={() => {
						isCollapsed.value = !isCollapsed.value;
					}}
				>
					<span
						ref={chevronRef}
						class="[&_svg]:ep:w-3 [&_svg]:ep:h-3"
					/>
					Recently Studied
				</Clickable>

				{isCollapsed.value && mostRecent && (
					<Clickable
						class="ep:text-ui-smaller ep:text-obs-interactive ep:hover:text-obs-normal ep:transition-colors ep:truncate ep:max-w-[200px]"
						onClick={() => {
							void plugin.openReviewViewWithFilters({
								sourceNoteFilter: mostRecent.name,
								ignoreDailyLimits: true,
							});
						}}
					>
						Continue: {mostRecent.name}
					</Clickable>
				)}
			</div>

			{/* Expanded list */}
			{!isCollapsed.value && (
				<div class="ep:flex ep:flex-col">
					{recentNotes.map((note) => (
						<Clickable
							key={note.name}
							class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:rounded ep:transition-all ep:duration-150 ep:hover:bg-obs-modifier-hover"
							onClick={() => openNote(note)}
						>
							<span class="ep:text-sm ep:text-obs-normal ep:truncate ep:mr-3 ep:flex-1">
								{note.name}
							</span>
							<span class="ep:text-xs ep:text-obs-muted ep:shrink-0">
								{note.lastReview
									? getTimeAgo(note.lastReview)
									: ""}
							</span>
						</Clickable>
					))}
				</div>
			)}
		</div>
	);
}
