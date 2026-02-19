import type { App, TFile } from "obsidian";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { BasePromiseModal } from "./BasePromiseModal";
import { filterNotesByQuery, MAX_DISPLAY_NOTES } from "./note-filter.utils";

export interface MoveCardResult {
	cancelled: boolean;
	targetNotePath: string | null;
}

export interface MoveCardModalOptions {
	cardCount: number;
	sourceNoteName?: string;
	cardQuestion?: string;
	cardAnswer?: string;
}

function noteHasTagPrefix(app: App, file: TFile, tagPrefix: string): boolean {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return false;

	const prefixLower = tagPrefix.toLowerCase();

	const frontmatterTags = (cache.frontmatter?.tags ?? []) as string | string[];
	const normalizedTags = Array.isArray(frontmatterTags)
		? frontmatterTags
		: [frontmatterTags];

	for (const tag of normalizedTags) {
		if (typeof tag !== "string") continue;
		const normalizedTag = (
			tag.startsWith("#") ? tag.slice(1) : tag
		).toLowerCase();
		if (normalizedTag.startsWith(prefixLower)) {
			return true;
		}
	}

	const inlineTags = cache.tags ?? [];
	return inlineTags.some((t) => {
		const tagWithoutHash = t.tag.slice(1).toLowerCase();
		return tagWithoutHash.startsWith(prefixLower);
	});
}

function extractBacklinks(
	cardQuestion?: string,
	cardAnswer?: string,
): string[] {
	const content = `${cardQuestion ?? ""} ${cardAnswer ?? ""}`;
	const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
	const links: string[] = [];
	let match: RegExpExecArray | null = linkRegex.exec(content);
	while (match !== null) {
		if (match[1]) links.push(match[1]);
		match = linkRegex.exec(content);
	}
	return [...new Set(links)];
}

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
			<button
				type="button"
				class="ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-smaller ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100"
				onClick={(e) => {
					e.stopPropagation();
					onSelect(note.path);
				}}
			>
				Select
			</button>
		</div>
	);
}

function MoveCardBody({
	allNotes,
	app,
	cardQuestion,
	cardAnswer,
	onResolve,
}: {
	allNotes: TFile[];
	app: App;
	cardQuestion?: string;
	cardAnswer?: string;
	onResolve: (result: MoveCardResult) => void;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const id = setTimeout(() => searchRef.current?.focus(), 50);
		return () => clearTimeout(id);
	}, []);

	const handleSelect = useCallback(
		(path: string) => {
			onResolve({ cancelled: false, targetNotePath: path });
		},
		[onResolve],
	);

	// Suggested notes from backlinks
	const backlinks = extractBacklinks(cardQuestion, cardAnswer);
	const suggestedNotes =
		backlinks.length > 0
			? allNotes.filter((note) =>
					backlinks.some(
						(link) => note.basename.toLowerCase() === link.toLowerCase(),
					),
				)
			: [];

	// Filtered notes
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

			<div class="ep:mb-3">
				<input
					ref={searchRef}
					type="text"
					placeholder="Search notes or #tags..."
					class="ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
					onInput={(e) =>
						setSearchQuery((e.target as HTMLInputElement).value.toLowerCase())
					}
				/>
			</div>

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

export class MoveCardModal extends BasePromiseModal<MoveCardResult> {
	private options: MoveCardModalOptions;
	private allNotes: TFile[] = [];
	private unmountBody?: () => void;

	constructor(app: App, options: MoveCardModalOptions) {
		super(app, {
			title:
				options.cardCount === 1
					? "Move flashcard to..."
					: `Move ${options.cardCount} flashcards to...`,
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): MoveCardResult {
		return { cancelled: true, targetNotePath: null };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-move-card-modal");
		this.allNotes = this.getValidNotes();
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<MoveCardBody
				allNotes={this.allNotes}
				app={this.app}
				cardQuestion={this.options.cardQuestion}
				cardAnswer={this.options.cardAnswer}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}

	private getValidNotes(): TFile[] {
		return this.app.vault.getMarkdownFiles().filter((file) => {
			if (
				this.options.sourceNoteName &&
				file.basename === this.options.sourceNoteName
			) {
				return false;
			}
			return true;
		});
	}
}
