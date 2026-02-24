import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import type { NoteAggregation } from "../DashboardApp";
import { getTimeAgo } from "../helpers/time-ago";
import { useMemo } from "preact/hooks";

export function RecentlyStudiedSection({
	notes,
}: {
	notes: NoteAggregation[];
}) {
	const plugin = usePlugin();

	const sortedNotes = useMemo(() => {
		return [...notes].sort((a, b) => {
			if (a.lastReview && !b.lastReview) return -1;
			if (!a.lastReview && b.lastReview) return 1;
			if (a.lastReview && b.lastReview)
				return b.lastReview.localeCompare(a.lastReview);
			return a.name.localeCompare(b.name);
		});
	}, [notes]);

	if (sortedNotes.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4">
				No study history yet.
			</div>
		);
	}

	return (
		<div>
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:pb-2 ep:mb-1 ep:border-b ep:border-obs-border">
				<span class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wider">
					Recently Studied
				</span>
				<span class="ep:text-[10px] ep:font-semibold ep:uppercase ep:tracking-wider ep:text-obs-muted">
					Last
				</span>
			</div>

			{/* Note rows */}
			<div class="ep:flex ep:flex-col">
				{sortedNotes.map((note) => (
					<Clickable
						key={note.name}
						class={[
							"ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:rounded ep:transition-all ep:duration-150 ep:hover:bg-obs-modifier-hover",
							note.lastReview ? "" : "ep:opacity-50",
						].join(" ")}
						style={{
							contentVisibility: "auto",
							containIntrinsicSize: "0 40px",
						}}
						onClick={() => {
							if (note.path) {
								const file =
									plugin.app.vault.getAbstractFileByPath(note.path);
								if (file) {
									void plugin.app.workspace
										.getLeaf(false)
										.openFile(file as import("obsidian").TFile);
								}
							}
						}}
					>
						<span class="ep:text-sm ep:text-obs-normal ep:truncate ep:mr-3 ep:flex-1">
							{note.name}
						</span>
						<span class="ep:text-xs ep:text-obs-muted ep:shrink-0">
							{note.lastReview ? getTimeAgo(note.lastReview) : "Never"}
						</span>
					</Clickable>
				))}
			</div>
		</div>
	);
}
