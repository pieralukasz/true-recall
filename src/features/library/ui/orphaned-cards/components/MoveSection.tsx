import type { TFile } from "obsidian";
import { useMemo } from "preact/hooks";
import type { OrphanedCardGroup } from "../../../services/orphaned-cards.service";
import { useApp } from "../../../../../shared/ui/preact";
import { SearchInput } from "../../../../../shared/ui/components";

interface NoteRowProps {
	note: TFile;
	onSelect: () => void;
}

function NoteRow({ note, onSelect }: NoteRowProps) {
	return (
		<button
			type="button"
			class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:hover:bg-obs-modifier-hover"
			onClick={onSelect}
		>
			<span class="ep:text-lg">📄</span>
			<div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					{note.basename}
				</div>
				{note.parent?.path && note.parent.path !== "/" && (
					<div class="ep:text-ui-smaller ep:text-obs-muted">
						{note.parent.path}
					</div>
				)}
			</div>
		</button>
	);
}

export interface MoveSectionProps {
	group: OrphanedCardGroup;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	onSelectNote: (note: TFile) => void;
	onCancel: () => void;
}

export function MoveSection({
	group,
	searchQuery,
	onSearchChange,
	onSelectNote,
	onCancel,
}: MoveSectionProps) {
	const app = useApp();

	const allNotes = useMemo(() => app.vault.getMarkdownFiles(), [app]);

	const filteredNotes = useMemo(() => {
		if (!searchQuery) {
			return allNotes.sort((a, b) => b.stat.mtime - a.stat.mtime);
		}
		const q = searchQuery.toLowerCase();
		return allNotes
			.filter(
				(note) =>
					note.basename.toLowerCase().includes(q) ||
					note.path.toLowerCase().includes(q),
			)
			.sort((a, b) => a.basename.localeCompare(b.basename));
	}, [allNotes, searchQuery]);

	const displayNotes = filteredNotes.slice(0, 20);

	return (
		<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
			<h4 class="ep:text-ui-small ep:text-obs-normal ep:m-0 ep:mb-3">
				Move {group.cards.length} cards to:
			</h4>

			<SearchInput
				value={searchQuery}
				placeholder="Search notes..."
				onChange={onSearchChange}
				class="ep:mb-3"
			/>

			<div class="ep:max-h-[200px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded-lg">
				{displayNotes.length === 0 ? (
					<div class="ep:p-4 ep:text-center ep:text-obs-muted ep:text-ui-smaller">
						No notes found
					</div>
				) : (
					displayNotes.map((note) => (
						<NoteRow
							key={note.path}
							note={note}
							onSelect={() => onSelectNote(note)}
						/>
					))
				)}
			</div>

			<button
				type="button"
				class="ep:mt-3 ep:py-2 ep:px-4 ep:rounded-md ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
				onClick={onCancel}
			>
				Cancel
			</button>
		</div>
	);
}
