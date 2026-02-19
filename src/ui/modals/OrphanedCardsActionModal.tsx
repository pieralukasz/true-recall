import { type App, normalizePath, type TFile } from "obsidian";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { FSRSCardData } from "../../types";
import { BasePromiseModal } from "./BasePromiseModal";

export type OrphanedCardsAction =
	| "delete"
	| "move"
	| "create_note"
	| "leave_orphaned";

export interface OrphanedCardsActionResult {
	cancelled: boolean;
	action: OrphanedCardsAction;
	targetNotePath?: string;
	newNotePath?: string;
}

export interface OrphanedCardsActionModalOptions {
	cards: FSRSCardData[];
	deletedNoteName: string;
	sourceUid: string;
}

function CardPreview({ cards }: { cards: FSRSCardData[] }) {
	const maxPreview = 3;
	const cardsToShow = cards.slice(0, maxPreview);

	return (
		<div class="ep:mb-4 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border">
			<h4 class="ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2">
				Card preview
			</h4>
			{cardsToShow.map((card, i) => {
				const question = card.question ?? "No question";
				const truncatedQ =
					question.length > 80 ? `${question.slice(0, 80)}...` : question;
				return (
					<div
						key={i}
						class="ep:py-1.5 ep:border-b ep:border-obs-border ep:last:border-b-0"
					>
						<div class="ep:text-ui-smaller ep:text-obs-normal">
							Q: {truncatedQ}
						</div>
					</div>
				);
			})}
			{cards.length > maxPreview && (
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:pt-1">
					... and {cards.length - maxPreview} more
				</div>
			)}
		</div>
	);
}

function ActionButton({
	icon,
	label,
	description,
	type,
	onClick,
}: {
	icon: string;
	label: string;
	description: string;
	type: "primary" | "secondary" | "danger";
	onClick: () => void;
}) {
	const iconMap: Record<string, string> = {
		"trash-2": "\u{1F5D1}\u{FE0F}",
		folder: "\u{1F4C1}",
		"file-plus": "\u{1F4DD}",
	};

	const btnCls =
		type === "danger"
			? "ep:bg-obs-red ep:text-obs-on-accent ep:hover:opacity-90"
			: "ep:bg-obs-secondary ep:text-obs-normal ep:hover:bg-obs-modifier-hover";

	return (
		<button
			class={`ep:w-full ep:py-3 ep:px-4 ep:rounded-md ep:border ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:text-left ${btnCls}`}
			onClick={onClick}
		>
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-lg">{iconMap[icon] ?? "\u{2022}"}</span>
				<div>
					<div class="ep:font-medium ep:text-ui-small">{label}</div>
					<div class="ep:text-ui-smaller ep:opacity-70">{description}</div>
				</div>
			</div>
		</button>
	);
}

function NoteItem({ note, onSelect }: { note: TFile; onSelect: () => void }) {
	const folderPath = note.parent?.path;

	return (
		<div
			class="ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group"
			onClick={onSelect}
		>
			<div class="ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1">
				<span class="ep:shrink-0">{"\u{1F4C4}"}</span>
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
				class="ep:shrink-0 ep:py-1 ep:px-3 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-smaller ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100"
				onClick={(e) => {
					e.stopPropagation();
					onSelect();
				}}
			>
				Select
			</button>
		</div>
	);
}

function MoveSection({
	allNotes,
	onSelect,
	onCancel,
}: {
	allNotes: TFile[];
	onSelect: (path: string) => void;
	onCancel: () => void;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setTimeout(() => searchRef.current?.focus(), 50);
	}, []);

	const filteredNotes = (() => {
		if (!searchQuery) {
			return [...allNotes].sort((a, b) => b.stat.mtime - a.stat.mtime);
		}
		const query = searchQuery.toLowerCase();
		return allNotes
			.filter(
				(note) =>
					note.basename.toLowerCase().includes(query) ||
					note.path.toLowerCase().includes(query),
			)
			.sort((a, b) => {
				const aExact = a.basename.toLowerCase().startsWith(query);
				const bExact = b.basename.toLowerCase().startsWith(query);
				if (aExact && !bExact) return -1;
				if (bExact && !aExact) return 1;
				return a.basename.localeCompare(b.basename);
			});
	})();

	const displayNotes = filteredNotes.slice(0, 30);

	return (
		<div class="ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border">
			<h4 class="ep:text-ui-small ep:text-obs-normal ep:m-0 ep:mb-3">
				Select target note
			</h4>

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
				style="max-height: 250px"
			>
				{filteredNotes.length === 0 ? (
					<div class="ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic">
						No notes found
					</div>
				) : (
					<>
						{displayNotes.map((note) => (
							<NoteItem
								key={note.path}
								note={note}
								onSelect={() => onSelect(note.path)}
							/>
						))}
						{filteredNotes.length > 30 && (
							<div class="ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller">
								Showing 30 of {filteredNotes.length} notes
							</div>
						)}
					</>
				)}
			</div>

			<button
				class="ep:mt-3 ep:py-2 ep:px-4 ep:rounded-md ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
				onClick={onCancel}
			>
				Cancel
			</button>
		</div>
	);
}

function OrphanedCardsBody({
	cards,
	deletedNoteName,
	allNotes,
	onResolve,
	onCreateNote,
}: {
	cards: FSRSCardData[];
	deletedNoteName: string;
	allNotes: TFile[];
	onResolve: (result: OrphanedCardsActionResult) => void;
	onCreateNote: () => void;
}) {
	const [showMoveSection, setShowMoveSection] = useState(false);

	const handleDelete = useCallback(() => {
		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		const confirmed = window.confirm(
			`Are you sure you want to delete ${cards.length} flashcard${cards.length === 1 ? "" : "s"}? This cannot be undone.`,
		);
		if (confirmed) {
			onResolve({ cancelled: false, action: "delete" });
		}
	}, [cards.length, onResolve]);

	return (
		<>
			<p class="ep:text-obs-normal ep:text-ui-small ep:mb-4">
				The note "{deletedNoteName}" was deleted. What would you like to do with
				its {cards.length} flashcard{cards.length === 1 ? "" : "s"}?
			</p>

			<CardPreview cards={cards} />

			<div class="ep:flex ep:flex-col ep:gap-2">
				<ActionButton
					icon="trash-2"
					label="Delete cards"
					description="Permanently remove these flashcards"
					type="danger"
					onClick={handleDelete}
				/>
				<ActionButton
					icon="folder"
					label="Move to another note"
					description="Transfer cards to an existing note"
					type="secondary"
					onClick={() => setShowMoveSection(true)}
				/>
				<ActionButton
					icon="file-plus"
					label="Create new note"
					description="Create a note with these cards"
					type="secondary"
					onClick={onCreateNote}
				/>
				<button
					class="ep:w-full ep:py-2 ep:px-3 ep:rounded-md ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:mt-2"
					onClick={() =>
						onResolve({ cancelled: false, action: "leave_orphaned" })
					}
				>
					Leave as orphaned (can manage later in settings)
				</button>
			</div>

			{showMoveSection && (
				<MoveSection
					allNotes={allNotes}
					onSelect={(path) =>
						onResolve({
							cancelled: false,
							action: "move",
							targetNotePath: path,
						})
					}
					onCancel={() => setShowMoveSection(false)}
				/>
			)}
		</>
	);
}

export class OrphanedCardsActionModal extends BasePromiseModal<OrphanedCardsActionResult> {
	private options: OrphanedCardsActionModalOptions;
	private allNotes: TFile[] = [];
	private unmountBody?: () => void;

	constructor(app: App, options: OrphanedCardsActionModalOptions) {
		super(app, {
			title: `Note deleted - ${options.cards.length} flashcard${options.cards.length === 1 ? "" : "s"}`,
			width: "550px",
		});
		this.options = options;
	}

	protected getDefaultResult(): OrphanedCardsActionResult {
		return { cancelled: false, action: "leave_orphaned" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-orphaned-cards-modal");
		this.allNotes = this.app.vault.getMarkdownFiles();
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<OrphanedCardsBody
				cards={this.options.cards}
				deletedNoteName={this.options.deletedNoteName}
				allNotes={this.allNotes}
				onResolve={(result) => this.resolve(result)}
				onCreateNote={() => void this.handleCreateNote()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}

	private async handleCreateNote(): Promise<void> {
		const folderPath = this.app.fileManager.getNewFileParent("")?.path ?? "";
		const baseName = `Recovered - ${this.options.deletedNoteName}`;

		let filePath = normalizePath(`${folderPath}/${baseName}.md`);
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			filePath = normalizePath(`${folderPath}/${baseName} ${counter}.md`);
			counter++;
		}

		this.resolve({
			cancelled: false,
			action: "create_note",
			newNotePath: filePath,
		});
	}
}
