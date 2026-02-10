import { App, TFile } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface MergeNotesNameResult {
	cancelled: boolean;
	newNoteName: string;
}

export interface MergeNotesNameModalOptions {
	files: TFile[];
	totalCards: number;
}

export class MergeNotesNameModal extends BasePromiseModal<MergeNotesNameResult> {
	private files: TFile[];
	private totalCards: number;
	private newNoteName = "";

	constructor(app: App, options: MergeNotesNameModalOptions) {
		super(app, {
			title: "Merge notes",
			width: "450px",
		});
		this.files = options.files;
		this.totalCards = options.totalCards;
	}

	protected getDefaultResult(): MergeNotesNameResult {
		return {
			cancelled: true,
			newNoteName: "",
		};
	}

	protected renderBody(container: HTMLElement): void {
		// Summary
		container.createEl("p", {
			text: `Merging ${this.files.length} notes with ${this.totalCards} flashcards total.`,
			cls: "ep:text-obs-normal ep:text-ui-small ep:mb-4",
		});

		// Selected notes preview (collapsed)
		const previewContainer = container.createDiv({
			cls: "ep:mb-4 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border",
		});
		previewContainer.createEl("h4", {
			text: "Notes to merge",
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:m-0 ep:mb-2",
		});

		const maxPreview = 5;
		const filesToShow = this.files.slice(0, maxPreview);
		for (const file of filesToShow) {
			previewContainer.createDiv({
				cls: "ep:py-0.5 ep:text-ui-smaller",
				text: file.basename,
			});
		}
		if (this.files.length > maxPreview) {
			previewContainer.createDiv({
				cls: "ep:py-0.5 ep:text-ui-smaller ep:text-obs-muted",
				text: `... and ${this.files.length - maxPreview} more`,
			});
		}

		// Name input
		container.createEl("label", {
			text: "New note name",
			cls: "ep:block ep:text-ui-small ep:text-obs-normal ep:mb-1",
		});

		const nameInput = container.createEl("input", {
			type: "text",
			placeholder: "Enter name for merged note...",
			cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive",
		});

		this.addDomEvent(nameInput, "input", () => {
			this.newNoteName = nameInput.value;
			mergeBtn.disabled = !this.newNoteName.trim();
		});

		this.addDomEvent(nameInput, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && this.newNoteName.trim()) {
				this.executeMerge();
			}
		});

		// Location hint
		const firstFile = this.files[0];
		const targetFolder = firstFile?.parent?.path || "/";
		container.createDiv({
			text: `Will be created in: ${targetFolder === "/" ? "vault root" : targetFolder}`,
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:mt-1 ep:mb-4",
		});

		// Buttons
		const buttonsRow = container.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2",
		});

		const cancelBtn = buttonsRow.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2 ep:px-4 ep:rounded-md ep:text-ui-small ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:cursor-pointer ep:hover:bg-obs-modifier-hover",
		});
		this.addDomEvent(cancelBtn, "click", () => this.close());

		const mergeBtn = buttonsRow.createEl("button", {
			text: "Merge",
			cls: "mod-cta ep:py-2 ep:px-4 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer",
		});
		mergeBtn.disabled = true;
		this.addDomEvent(mergeBtn, "click", () => this.executeMerge());

		// Auto-focus
		setTimeout(() => nameInput.focus(), 50);
	}

	private executeMerge(): void {
		if (!this.newNoteName.trim()) return;

		this.resolve({
			cancelled: false,
			newNoteName: this.newNoteName.trim(),
		});
	}
}
