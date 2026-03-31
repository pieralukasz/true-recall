import { useComputed } from "@preact/signals";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { State } from "ts-fsrs";
import { WidgetCta } from "../WidgetCta";

interface UnassignedNote {
	path: string;
	name: string;
	cardCount: number;
	newCount: number;
	dueCount: number;
}

export function UnassignedNotesWidget() {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const cardsBySource = useQuery<Map<string, CardSchedulingMeta[]>>(
		Q.CARDS_BY_SOURCE,
	);

	const notes = useComputed((): UnassignedNote[] => {
		void allMeta.value;

		const unassignedPaths = plugin.hierarchyService.getUnassignedPaths();

		const result: UnassignedNote[] = [];
		const now = new Date();
		const uidMap = cardsBySource.value;

		for (const path of unassignedPaths) {
			const uids = plugin.frontmatterIndex.getValues("flashcard_uid", path);
			const uid = uids[0];
			if (!uid) continue;

			const uidCards = uidMap.get(uid) ?? [];
			if (uidCards.length === 0) continue;

			let newCount = 0;
			let dueCount = 0;
			let activeCount = 0;

			for (const card of uidCards) {
				const fsrs = card.fsrs;
				if (fsrs.suspended) continue;
				if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) continue;
				activeCount++;

				if (fsrs.state === State.New) newCount++;
				else if (
					fsrs.state === State.Learning ||
					fsrs.state === State.Relearning
				)
					dueCount++;
				else if (fsrs.state === State.Review && new Date(fsrs.due) <= now)
					dueCount++;
			}

			const file = plugin.app.vault.getAbstractFileByPath(path);
			const name = file?.name?.replace(/\.md$/, "") ?? path;

			result.push({
				path,
				name,
				cardCount: activeCount,
				newCount,
				dueCount,
			});
		}

		// Sort by due count descending, then by name
		result.sort(
			(a, b) => b.dueCount - a.dueCount || a.name.localeCompare(b.name),
		);
		return result;
	}).value;

	if (notes.length === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				All flashcard notes are assigned to projects.
			</div>
		);
	}

	const handleOpenNote = (path: string) => {
		void plugin.app.workspace.openLinkText(path, "", false);
	};

	const handleReviewAll = () => {
		// Collect all source UIDs from unassigned notes
		const uids = new Set<string>();
		for (const note of notes) {
			const noteUids = plugin.frontmatterIndex.getValues(
				"flashcard_uid",
				note.path,
			);
			for (const uid of noteUids) uids.add(uid);
		}

		// Open review with these UIDs as sourceNoteFilters
		const noteNames = notes.map((n) => n.name).filter((n): n is string => !!n);
		plugin.startReview({ mode: "notes", noteNames }).catch(() => {});
	};

	const totalDue = notes.reduce((sum, n) => sum + n.dueCount, 0);
	const totalNew = notes.reduce((sum, n) => sum + n.newCount, 0);

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between">
				<span class="ep:font-semibold ep:text-obs-normal">
					Unassigned Notes
				</span>
				<span class="ep:text-xs ep:text-obs-muted">
					{notes.length} note{notes.length !== 1 ? "s" : ""}
				</span>
			</div>

			{/* Summary */}
			{(totalDue > 0 || totalNew > 0) && (
				<div class="ep:flex ep:gap-3 ep:text-xs">
					{totalDue > 0 && (
						<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
							{totalDue} due
						</span>
					)}
					{totalNew > 0 && (
						<span style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
							{totalNew} new
						</span>
					)}
				</div>
			)}

			{/* Note list */}
			<div class="ep:flex ep:flex-col ep:gap-1 ep:max-h-60 ep:overflow-y-auto">
				{notes.map((note) => (
					<Clickable
						key={note.path}
						class="ep:flex ep:items-center ep:justify-between ep:px-2 ep:py-1 ep:rounded ep:bg-obs-secondary hover:ep:bg-obs-tertiary ep:transition-colors"
						onClick={() => handleOpenNote(note.path)}
					>
						<span class="ep:truncate ep:flex-1 ep:text-obs-normal ep:text-xs">
							{note.name}
						</span>
						<div class="ep:flex ep:gap-2 ep:ml-2 ep:text-[10px] ep:shrink-0">
							{note.dueCount > 0 && (
								<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
									{note.dueCount}
								</span>
							)}
							{note.newCount > 0 && (
								<span style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
									{note.newCount}
								</span>
							)}
							<span class="ep:text-obs-faint">{note.cardCount}</span>
						</div>
					</Clickable>
				))}
			</div>

			{/* Review button */}
			{totalDue > 0 && (
				<WidgetCta
					label={`Review Unassigned (${totalDue} due)`}
					onClick={handleReviewAll}
				/>
			)}
		</div>
	);
}
