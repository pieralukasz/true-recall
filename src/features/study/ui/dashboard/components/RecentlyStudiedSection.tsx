import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import type { NoteAggregation } from "../DashboardApp";
import { getTimeAgo } from "../helpers/time-ago";

export function RecentlyStudiedSection({
	notes,
}: {
	notes: NoteAggregation[];
}) {
	const plugin = usePlugin();

	const recentNotes = notes
		.filter((n) => n.lastReview !== null)
		.sort((a, b) => {
			if (!a.lastReview || !b.lastReview) return 0;
			return b.lastReview.localeCompare(a.lastReview);
		})
		.slice(0, 8);

	if (recentNotes.length === 0) return null;

	return (
		<div class="ep:mb-4">
			<div class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider ep:mb-2">
				Recently Studied
			</div>
			<div class="ep:flex ep:flex-col ep:gap-1.5">
				{recentNotes.map((note) => (
					<Clickable
						key={note.name}
						class="ep:flex ep:items-center ep:justify-between ep:p-3 ep:rounded-lg ep:bg-obs-secondary ep:transition-all ep:duration-200 ep:hover:bg-obs-modifier-hover"
						onClick={() => {
							if (note.path) {
								const file =
									plugin.app.vault.getAbstractFileByPath(note.path);
								if (file) {
									void plugin.app.workspace.getLeaf(false).openFile(
										file as import("obsidian").TFile,
									);
								}
							}
						}}
					>
						<span class="ep:text-sm ep:text-obs-normal ep:truncate ep:mr-3 ep:flex-1">
							{note.name}
						</span>
						<span class="ep:text-xs ep:text-obs-muted ep:shrink-0">
							{note.lastReview ? getTimeAgo(note.lastReview) : ""}
						</span>
					</Clickable>
				))}
			</div>
		</div>
	);
}
