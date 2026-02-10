import { App, TFile } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";
import type { MergeNotesService } from "../../services/notes/merge-notes.service";
import { debounce } from "../../utils/event.utils";

export interface MergeNotesModalResult {
	cancelled: boolean;
	selectedNotes: TFile[];
	newNoteName: string;
}

export interface MergeNotesModalOptions {
	mergeService: MergeNotesService;
}

type ModalStep = 1 | 2;

export class MergeNotesModal extends BasePromiseModal<MergeNotesModalResult> {
	private mergeService: MergeNotesService;

	// Pagination
	private readonly PAGE_SIZE = 30;
	private displayLimit = 30;

	// State
	private currentStep: ModalStep = 1;
	private selectedNotes = new Set<TFile>();
	private searchQuery = "";
	private newNoteName = "";

	// DOM references
	private noteListEl: HTMLElement | null = null;
	private step1Container: HTMLElement | null = null;
	private step2Container: HTMLElement | null = null;
	private continueBtn: HTMLButtonElement | null = null;

	// Cached data (lazy loaded)
	private allZettelNotes: TFile[] = [];
	private cardCounts = new Map<string, number>();

	// Debounced search
	private debouncedSearch = debounce((query: string) => {
		this.searchQuery = query;
		this.displayLimit = this.PAGE_SIZE; // Reset pagination on search
		this.renderNoteList();
	}, 300);

	constructor(app: App, options: MergeNotesModalOptions) {
		super(app, {
			title: "Merge zettel notes",
			width: "550px",
		});
		this.mergeService = options.mergeService;
	}

	protected getDefaultResult(): MergeNotesModalResult {
		return {
			cancelled: true,
			selectedNotes: [],
			newNoteName: "",
		};
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-merge-notes-modal");

		// Load data (card counts computed lazily)
		this.allZettelNotes = this.mergeService.getZettelNotes()
			.sort((a, b) => b.stat.mtime - a.stat.mtime);
	}

	private getCardCount(note: TFile): number {
		if (!this.cardCounts.has(note.path)) {
			const count = this.mergeService.getCardCountForNote(note);
			this.cardCounts.set(note.path, count);
		}
		return this.cardCounts.get(note.path) ?? 0;
	}

	protected renderBody(container: HTMLElement): void {
		// Step 1: Note selection
		this.step1Container = container.createDiv();
		this.renderStep1(this.step1Container);

		// Step 2: Configuration (hidden initially)
		this.step2Container = container.createDiv({ cls: "ep:hidden" });
	}

	private renderStep1(container: HTMLElement): void {
		// Description
		container.createEl("p", {
			text: `Select notes with #mind/zettel tag to merge. Found ${this.allZettelNotes.length} notes.`,
			cls: "ep:text-obs-normal ep:text-ui-small ep:mb-3",
		});

		// Search with debounce
		this.createSearchInput(container, "Search notes...", (query) => {
			this.debouncedSearch(query);
		});

		// Note list
		this.noteListEl = this.createListContainer(container, "300px");
		this.renderNoteList();

		// Selection counter + Continue button
		const actionsRow = container.createDiv({
			cls: "ep:flex ep:justify-between ep:items-center ep:mt-3",
		});

		actionsRow.createDiv({
			cls: "ep:text-ui-small ep:text-obs-muted selection-counter",
			text: this.getSelectionCounterText(),
		});

		this.continueBtn = actionsRow.createEl("button", {
			text: "Continue",
			cls: "mod-cta ep:py-2 ep:px-4 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer",
		});
		this.continueBtn.disabled = this.selectedNotes.size < 2;

		this.addDomEvent(this.continueBtn, "click", () => {
			this.proceedToStep2();
		});
	}

	private renderNoteList(): void {
		if (!this.noteListEl) return;
		this.noteListEl.empty();

		const filteredNotes = this.filterNotes();

		if (filteredNotes.length === 0) {
			this.createEmptyState(
				this.noteListEl,
				this.searchQuery ? "No notes found" : "No #mind/zettel notes in vault"
			);
			return;
		}

		// Paginate
		const displayNotes = filteredNotes.slice(0, this.displayLimit);

		for (const note of displayNotes) {
			const cardCount = this.getCardCount(note); // Lazy loading
			const isSelected = this.selectedNotes.has(note);

			this.createSelectableItem(this.noteListEl, {
				name: note.basename,
				description: note.parent?.path !== "/" ? note.parent?.path : undefined,
				badge: cardCount > 0 ? `${cardCount} cards` : undefined,
				selected: isSelected,
				onToggle: (selected) => {
					if (selected) {
						this.selectedNotes.add(note);
					} else {
						this.selectedNotes.delete(note);
					}
					this.updateSelectionUI();
				},
			});
		}

		// "Load more" button if there are more notes
		if (filteredNotes.length > this.displayLimit) {
			const remaining = filteredNotes.length - this.displayLimit;
			const loadMoreBtn = this.noteListEl.createEl("button", {
				text: `Load more (${remaining} remaining)`,
				cls: "ep:w-full ep:py-2 ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-normal",
			});
			this.addDomEvent(loadMoreBtn, "click", () => {
				this.displayLimit += this.PAGE_SIZE;
				this.renderNoteList();
			});
		}
	}

	private filterNotes(): TFile[] {
		if (!this.searchQuery) {
			return this.allZettelNotes;
		}

		const query = this.searchQuery.toLowerCase();
		return this.allZettelNotes.filter(
			(note) =>
				note.basename.toLowerCase().includes(query) ||
				note.path.toLowerCase().includes(query)
		);
	}

	private updateSelectionUI(): void {
		// Update counter
		const counter = this.step1Container?.querySelector(".selection-counter");
		if (counter) {
			counter.textContent = this.getSelectionCounterText();
		}

		// Update button state
		if (this.continueBtn) {
			this.continueBtn.disabled = this.selectedNotes.size < 2;
		}
	}

	private getSelectionCounterText(): string {
		const count = this.selectedNotes.size;
		const totalCards = Array.from(this.selectedNotes).reduce(
			(sum, note) => sum + this.getCardCount(note),
			0
		);
		return `${count} selected (${totalCards} cards total)`;
	}

	private proceedToStep2(): void {
		if (this.selectedNotes.size < 2) return;

		this.currentStep = 2;
		this.updateTitle("Merge zettel notes - Name");

		// Hide step 1, show step 2
		this.step1Container?.addClass("ep:hidden");
		this.step2Container?.removeClass("ep:hidden");

		this.renderStep2();
	}

	private renderStep2(): void {
		if (!this.step2Container) return;
		this.step2Container.empty();

		const selectedList = Array.from(this.selectedNotes);
		const totalCards = selectedList.reduce(
			(sum, note) => sum + this.getCardCount(note),
			0
		);

		// Summary
		this.step2Container.createEl("p", {
			text: `Merging ${selectedList.length} notes with ${totalCards} flashcards total.`,
			cls: "ep:text-obs-normal ep:text-ui-small ep:mb-4",
		});

		// Selected notes list
		const selectedContainer = this.step2Container.createDiv({
			cls: "ep:mb-4 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border",
		});
		selectedContainer.createEl("h4", {
			text: "Notes to merge",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2",
		});

		for (const note of selectedList) {
			const cardCount = this.getCardCount(note);
			selectedContainer.createDiv({
				cls: "ep:py-1 ep:text-ui-smaller",
				text: `${note.basename}${cardCount > 0 ? ` (${cardCount} cards)` : ""}`,
			});
		}

		// Name input
		this.step2Container.createEl("label", {
			text: "New note name",
			cls: "ep:block ep:text-ui-small ep:text-obs-normal ep:mb-1",
		});

		const nameInput = this.step2Container.createEl("input", {
			type: "text",
			placeholder: "Enter name for merged note...",
			cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive",
		});
		nameInput.value = this.newNoteName;

		this.addDomEvent(nameInput, "input", () => {
			this.newNoteName = nameInput.value;
			this.updateMergeButtonState(mergeBtn);
		});

		// Location hint
		const firstNote = selectedList[0];
		const targetFolder = firstNote?.parent?.path || "/";
		this.step2Container.createDiv({
			text: `Will be created in: ${targetFolder === "/" ? "vault root" : targetFolder}`,
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mt-1 ep:mb-4",
		});

		// Buttons
		const buttonsRow = this.step2Container.createDiv({
			cls: "ep:flex ep:justify-between ep:gap-2",
		});

		const backBtn = buttonsRow.createEl("button", {
			text: "Back",
			cls: "ep:py-2 ep:px-4 ep:rounded-md ep:text-ui-small ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});
		this.addDomEvent(backBtn, "click", () => this.goBackToStep1());

		const mergeBtn = buttonsRow.createEl("button", {
			text: "Merge notes",
			cls: "mod-cta ep:py-2 ep:px-4 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer",
		});
		mergeBtn.disabled = !this.newNoteName.trim();

		this.addDomEvent(mergeBtn, "click", () => this.executeMerge());

		// Auto-focus
		setTimeout(() => nameInput.focus(), 50);
	}

	private updateMergeButtonState(btn: HTMLButtonElement): void {
		btn.disabled = !this.newNoteName.trim();
	}

	private goBackToStep1(): void {
		this.currentStep = 1;
		this.updateTitle("Merge zettel notes");

		this.step2Container?.addClass("ep:hidden");
		this.step1Container?.removeClass("ep:hidden");
	}

	private executeMerge(): void {
		if (!this.newNoteName.trim() || this.selectedNotes.size < 2) return;

		this.resolve({
			cancelled: false,
			selectedNotes: Array.from(this.selectedNotes),
			newNoteName: this.newNoteName.trim(),
		});
	}
}
