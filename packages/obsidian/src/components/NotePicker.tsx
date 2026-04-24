import type { TFile } from "obsidian";
import { useMemo, useState } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { NoteListItem } from "@true-recall/obsidian/components/NoteListItem";
import { SearchInput } from "@true-recall/obsidian/components/SearchInput";

interface NotePickerProps {
	notes: TFile[];
	onSelect: (note: TFile) => void;
	onCancel?: () => void;
	maxResults?: number;
	title?: string;
	suggestedPaths?: Set<string>;
}

export function NotePicker({
	notes,
	onSelect,
	onCancel,
	maxResults = 50,
	title,
	suggestedPaths,
}: NotePickerProps) {
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		if (!search.trim()) return notes.slice(0, maxResults);
		const q = search.toLowerCase();
		return notes
			.filter((n) => n.basename.toLowerCase().includes(q))
			.slice(0, maxResults);
	}, [notes, search, maxResults]);

	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			{title && (
				<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0">
					{title}
				</h4>
			)}
			<SearchInput
				value={search}
				onChange={setSearch}
				placeholder="Search notes..."
				ariaLabel="Search notes"
			/>
			<div class="ep:max-h-[200px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded-md">
				{filtered.length === 0 ? (
					<div class="ep:p-3 ep:text-ui-small ep:text-obs-muted ep:text-center">
						No notes found
					</div>
				) : (
					filtered.map((note) => (
						<NoteListItem
							key={note.path}
							note={note}
							onSelect={() => onSelect(note)}
							isSuggested={suggestedPaths?.has(note.path)}
						/>
					))
				)}
			</div>
			{onCancel && (
				<Clickable
					class="ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border-none ep:self-start"
					onClick={onCancel}
				>
					Cancel
				</Clickable>
			)}
		</div>
	);
}
