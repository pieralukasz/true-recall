import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import {
	filterNotesByQuery,
	MAX_DISPLAY_NOTES,
} from "@shared/ui/modals/note-filter.utils";
import { type App, normalizePath, type TFile } from "obsidian";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

export interface SelectNoteResult {
	cancelled: boolean;
	selectedNote: TFile | null;
}

export interface SelectNoteModalOptions {
	title?: string;
	excludeFolder?: string;
	excludeFlashcardFiles?: boolean;
}

function SelectNoteBody({
	allNotes,
	onResolve,
}: {
	allNotes: TFile[];
	onResolve: (result: SelectNoteResult) => void;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => searchRef.current?.focus(), 50);
		return () => clearTimeout(id);
	}, []);

	const filteredNotes = filterNotesByQuery(allNotes, searchQuery);
	const displayNotes = filteredNotes.slice(0, MAX_DISPLAY_NOTES);

	const emptyText = searchQuery
		? "No notes found matching your search."
		: "No notes available.";

	return (
		<>
			<p class="ep:text-obs-muted ep:text-ui-small ep:mb-4">
				Select a note to create a project from.
			</p>

			<div class="ep:mb-3">
				<input
					ref={searchRef}
					type="text"
					placeholder="Search notes..."
					class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
					onInput={(e) =>
						setSearchQuery((e.target as HTMLInputElement).value.toLowerCase())
					}
				/>
			</div>

			<div
				class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto"
				style="max-height: 350px"
			>
				{displayNotes.length === 0 ? (
					<div class="ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic">
						{emptyText}
					</div>
				) : (
					<>
						{displayNotes.map((note) => {
							const folderPath = note.parent?.path;
							return (
								<button
									type="button"
									key={note.path}
									class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group"
									onClick={() =>
										onResolve({
											cancelled: false,
											selectedNote: note,
										})
									}
								>
									<div class="ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1">
										<span class="ep:shrink-0">📄</span>
										<span class="ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
											{note.basename}
										</span>
										{folderPath && folderPath !== "/" && (
											<span class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">
												{folderPath}
											</span>
										)}
									</div>
									<span class="ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:text-ui-smaller ep:opacity-0 ep:group-hover:opacity-100">
										Select
									</span>
								</button>
							);
						})}
						{filteredNotes.length > MAX_DISPLAY_NOTES && (
							<div class="ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-small">
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

export class SelectNoteModal extends BasePromiseModal<SelectNoteResult> {
	private options: SelectNoteModalOptions;
	private allNotes: TFile[] = [];

	constructor(app: App, options: SelectNoteModalOptions = {}) {
		super(app, {
			title: options.title ?? "Select Note",
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): SelectNoteResult {
		return { cancelled: true, selectedNote: null };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-select-note-modal");
		this.allNotes = this.getValidNotes();
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<SelectNoteBody
				allNotes={this.allNotes}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}

	private getValidNotes(): TFile[] {
		const excludeFolder = this.options.excludeFolder
			? normalizePath(this.options.excludeFolder)
			: null;

		return this.app.vault.getMarkdownFiles().filter((file) => {
			if (excludeFolder && file.path.startsWith(`${excludeFolder}/`)) {
				return false;
			}
			return true;
		});
	}
}
