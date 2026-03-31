import { Clickable } from "@true-recall/obsidian/components";
import { SearchInput } from "@true-recall/obsidian/components/SearchInput";
import type { MoveCardResult } from "@true-recall/obsidian/modals/shared/MoveCardModal";
import {
	extractBacklinks,
	noteHasTagPrefix,
} from "@true-recall/obsidian/modals/shared/move-card/move-card.utils";
import {
	filterNotesByQuery,
	MAX_DISPLAY_NOTES,
} from "@true-recall/obsidian/modals/shared/note-filter.utils";
import type { App, TFile } from "obsidian";
import { useCallback, useState } from "preact/hooks";

function NoteItem({
	note,
	isSuggested,
	onSelect,
}: {
	note: TFile;
	isSuggested?: boolean;
	onSelect: (path: string) => void;
}) {
	const baseCls =
		"ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group";
	const suggestedCls =
		"ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive ep:rounded-lg ep:mb-1";

	const folderPath = note.parent?.path;

	return (
		<div
			class={isSuggested ? `${baseCls} ${suggestedCls}` : baseCls}
			role="option"
			tabIndex={0}
			onClick={() => onSelect(note.path)}
			onKeyDown={(e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(note.path);
				}
			}}
		>
			<div class="ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1">
				<span class="ep:shrink-0">
					{isSuggested ? "\u{1F4A1}" : "\u{1F4C4}"}
				</span>
				<span class="ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
					{note.basename}
				</span>
				{folderPath && folderPath !== "/" && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">
						{folderPath}
					</span>
				)}
			</div>
			<Clickable
				class="ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-smaller ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100"
				onClick={() => onSelect(note.path)}
			>
				Select
			</Clickable>
		</div>
	);
}

export interface MoveCardBodyProps {
	allNotes: TFile[];
	app: App;
	cardQuestion?: string;
	cardAnswer?: string;
	onResolve: (result: MoveCardResult) => void;
}

export function MoveCardBody({
	allNotes,
	app,
	cardQuestion,
	cardAnswer,
	onResolve,
}: MoveCardBodyProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const handleSelect = useCallback(
		(path: string) => {
			onResolve({ cancelled: false, targetNotePath: path });
		},
		[onResolve],
	);

	const backlinks = extractBacklinks(cardQuestion, cardAnswer);
	const suggestedNotes =
		backlinks.length > 0
			? allNotes.filter((note) =>
					backlinks.some(
						(link) => note.basename.toLowerCase() === link.toLowerCase(),
					),
				)
			: [];

	const filteredNotes = (() => {
		if (searchQuery.startsWith("#")) {
			const tagPrefix = searchQuery.slice(1).toLowerCase();
			return [...allNotes]
				.filter((note) => noteHasTagPrefix(app, note, tagPrefix))
				.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}
		return filterNotesByQuery(allNotes, searchQuery);
	})();

	const displayNotes = filteredNotes.slice(0, MAX_DISPLAY_NOTES);

	const emptyText = searchQuery
		? searchQuery.startsWith("#")
			? `No notes found with tag ${searchQuery}.`
			: "No notes found matching your search."
		: "No notes available.";

	return (
		<>
			<p class="ep:text-obs-muted ep:text-ui-small ep:mb-4">
				Select a note to move the flashcard(s) to. A flashcard file will be
				created if it doesn't exist.
			</p>

			<SearchInput
				value={searchQuery}
				onChange={setSearchQuery}
				placeholder="Search notes or #tags..."
				ariaLabel="Search notes or tags"
				autoFocus
				class="ep:mb-3"
			/>

			{suggestedNotes.length > 0 && (
				<div class="ep:mb-4 ep:pb-3 ep:border-b ep:border-obs-border">
					<h4 class="ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2">
						Suggested (from backlinks)
					</h4>
					{suggestedNotes.map((note) => (
						<NoteItem
							key={note.path}
							note={note}
							isSuggested
							onSelect={handleSelect}
						/>
					))}
				</div>
			)}

			<div
				class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto"
				style="max-height: 350px"
			>
				{filteredNotes.length === 0 ? (
					<div class="ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic">
						{emptyText}
					</div>
				) : (
					<>
						{displayNotes.map((note) => (
							<NoteItem key={note.path} note={note} onSelect={handleSelect} />
						))}
						{filteredNotes.length > MAX_DISPLAY_NOTES && (
							<div class="ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller">
								Showing {MAX_DISPLAY_NOTES} of {filteredNotes.length} notes.
								Type to search for more.
							</div>
						)}
					</>
				)}
			</div>
		</>
	);
}
