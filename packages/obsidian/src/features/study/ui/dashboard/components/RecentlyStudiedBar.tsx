import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback } from "preact/hooks";
import type { DashboardNoteEntry } from "../types";
import { MiniDonut } from "./MiniDonut";

interface RecentlyStudiedBarProps {
	notes: DashboardNoteEntry[];
}

export function RecentlyStudiedBar({ notes }: RecentlyStudiedBarProps) {
	const plugin = usePlugin();

	const handleClick = useCallback(
		(note: DashboardNoteEntry) => {
			if (note.priority === "done" && note.path) {
				void plugin.app.workspace.openLinkText(note.name, "");
			} else {
				void plugin.startReview({ mode: "notes", noteNames: [note.name] });
			}
		},
		[plugin],
	);

	if (notes.length === 0) return null;

	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:px-1 ep:overflow-hidden">
			<span class="ep:text-sm ep:text-obs-muted ep:shrink-0 ep:py-1">
				Recently Studied
			</span>
			<div class="ep:flex ep:items-center ep:gap-1.5 ep:overflow-x-auto ep:min-w-0">
				{notes.map((note) => (
					<Clickable
						key={note.name}
						class="ep:shrink-0 ep:inline-flex ep:items-center ep:gap-1.5 ep:pl-1.5 ep:pr-2.5 ep:py-0.5 ep:text-xs ep:text-obs-muted ep:rounded-full ep:bg-obs-modifier-hover/50 ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors ep:max-w-[200px]"
						onClick={() => handleClick(note)}
						title={`${note.due} due, ${note.newCount} new, ${note.learning} learning / ${note.total} total`}
					>
						<MiniDonut
							due={note.due}
							newCount={note.newCount}
							learning={note.learning}
							total={note.total}
						/>
						<span class="ep:truncate">{note.name}</span>
					</Clickable>
				))}
			</div>
		</div>
	);
}
