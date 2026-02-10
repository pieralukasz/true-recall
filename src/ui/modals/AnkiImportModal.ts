import { App } from "obsidian";
import { BaseModal } from "./BaseModal";
import type { AnkiImportResult, ApkgData } from "../../types";
import type { SqliteStoreService } from "../../services/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../../services/core/fsrs.service";
import { ApkgParserService } from "../../services/anki/apkg-parser.service";
import { AnkiConverterService } from "../../services/anki/anki-converter.service";
import { AnkiImportService } from "../../services/anki/anki-import.service";

interface ImportPreview {
	totalCards: number;
	basicCards: number;
	clozeCards: number;
	reversedCards: number;
	decks: string[];
	mediaCount: number;
}

export class AnkiImportModal extends BaseModal {
	private store: SqliteStoreService;
	private fsrsService: FSRSService;

	private fileData: ArrayBuffer | null = null;
	private preview: ImportPreview | null = null;

	private importScheduling = true;
	private importMedia = true;
	private mediaFolder = "Attachments/anki-import";

	private bodyEl: HTMLElement | null = null;

	constructor(app: App, store: SqliteStoreService, fsrsService: FSRSService) {
		super(app, { title: "Import Anki deck", width: "520px" });
		this.store = store;
		this.fsrsService = fsrsService;
	}

	protected renderBody(container: HTMLElement): void {
		this.bodyEl = container;
		this.renderFileSelection(container);
	}

	private renderFileSelection(container: HTMLElement): void {
		container.empty();

		const desc = container.createDiv({
			cls: "ep:text-ui-small ep:text-obs-muted ep:mb-4",
		});
		desc.setText(
			"Select an .apkg file exported from Anki to import your flashcards.",
		);

		const dropZone = container.createDiv({
			cls: "ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:p-8 ep:text-center ep:cursor-pointer ep:transition-colors ep:hover:border-obs-interactive ep:hover:bg-obs-modifier-hover",
		});

		const fileInput = dropZone.createEl("input", {
			type: "file",
			attr: { accept: ".apkg", style: "display: none" },
		});

		const label = dropZone.createDiv({
			cls: "ep:text-ui-small ep:text-obs-muted",
		});
		label.setText("Click to select .apkg file");

		this.addDomEvent(dropZone, "click", () => fileInput.click());
		this.addDomEvent(fileInput, "change", () => {
			const file = fileInput.files?.[0];
			if (file) void this.handleFileSelected(file);
		});

		// Drag & drop
		this.addDomEvent(dropZone, "dragover", (e: DragEvent) => {
			e.preventDefault();
			dropZone.addClass("ep:border-obs-interactive", "ep:bg-obs-modifier-hover");
		});
		this.addDomEvent(dropZone, "dragleave", () => {
			dropZone.removeClass("ep:border-obs-interactive", "ep:bg-obs-modifier-hover");
		});
		this.addDomEvent(dropZone, "drop", (e: DragEvent) => {
			e.preventDefault();
			dropZone.removeClass("ep:border-obs-interactive", "ep:bg-obs-modifier-hover");
			const file = e.dataTransfer?.files[0];
			if (file && file.name.endsWith(".apkg")) {
				void this.handleFileSelected(file);
			}
		});
	}

	private async handleFileSelected(file: File): Promise<void> {
		if (!this.bodyEl) return;
		const container = this.bodyEl;
		container.empty();

		const loadingEl = container.createDiv({
			cls: "ep:text-center ep:py-6",
		});
		loadingEl.setText("Parsing deck...");

		try {
			this.fileData = await file.arrayBuffer();

			const parser = new ApkgParserService(this.app);
			const apkgData = await parser.parseApkg(this.fileData);

			const converter = new AnkiConverterService();
			const convertedCards = converter.convert(apkgData);

			this.preview = {
				totalCards: convertedCards.length,
				basicCards: convertedCards.filter(
					(c) => c.cardType === "basic",
				).length,
				clozeCards: convertedCards.filter(
					(c) => c.cardType === "cloze",
				).length,
				reversedCards: convertedCards.filter(
					(c) => c.cardType === "reversed",
				).length,
				decks: this.getUniqueDecks(apkgData),
				mediaCount: Object.keys(apkgData.mediaMap).length,
			};

			this.renderPreview(container);
		} catch (err) {
			container.empty();
			const errMsg = err instanceof Error ? err.message : String(err);
			container.createDiv({
				text: `Failed to parse file: ${errMsg}`,
				cls: "ep:text-ui-small ep:text-red-500 ep:py-4",
			});
			this.createButtonsSection(container, [
				{
					text: "Try again",
					type: "secondary",
					onClick: () => this.renderFileSelection(container),
				},
				{
					text: "Close",
					type: "secondary",
					onClick: () => this.close(),
				},
			]);
		}
	}

	private renderPreview(container: HTMLElement): void {
		container.empty();
		if (!this.preview) return;

		this.updateTitle(`Import Anki deck (${this.preview.totalCards} cards)`);

		// Stats grid
		const stats = container.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-2 ep:mb-4",
		});

		this.renderStatBadge(stats, "Basic", this.preview.basicCards);
		this.renderStatBadge(stats, "Cloze", this.preview.clozeCards);
		this.renderStatBadge(stats, "Reversed", this.preview.reversedCards);
		this.renderStatBadge(stats, "Media files", this.preview.mediaCount);

		// Deck list
		if (this.preview.decks.length > 0) {
			const deckSection = container.createDiv({ cls: "ep:mb-4" });
			deckSection.createDiv({
				text: "Decks (will become projects):",
				cls: "ep:text-ui-small ep:font-medium ep:mb-2",
			});
			const deckList = deckSection.createDiv({
				cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[120px] ep:overflow-y-auto ep:p-2",
			});
			for (const deck of this.preview.decks) {
				deckList.createDiv({
					text: deck,
					cls: "ep:text-ui-smaller ep:text-obs-muted ep:py-0.5",
				});
			}
		}

		// Options
		const optionsSection = container.createDiv({ cls: "ep:mb-4" });
		optionsSection.createDiv({
			text: "Options",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});

		this.renderCheckbox(
			optionsSection,
			"Import scheduling data",
			"Replay review history to preserve your progress",
			this.importScheduling,
			(val) => (this.importScheduling = val),
		);

		this.renderCheckbox(
			optionsSection,
			"Import media files",
			`${this.preview.mediaCount} files will be saved to ${this.mediaFolder}`,
			this.importMedia,
			(val) => (this.importMedia = val),
		);

		// Buttons
		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.close(),
			},
			{
				text: "Import",
				type: "primary",
				onClick: () => void this.startImport(),
			},
		]);
	}

	private async startImport(): Promise<void> {
		if (!this.bodyEl || !this.fileData) return;
		const container = this.bodyEl;
		container.empty();

		const progressEl = container.createDiv({
			cls: "ep:text-center ep:py-6",
		});
		progressEl.createDiv({
			text: "Importing...",
			cls: "ep:text-ui-small ep:font-medium ep:mb-2",
		});
		const statusEl = progressEl.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});
		statusEl.setText("This may take a moment for large decks");

		try {
			const importService = new AnkiImportService(
				this.app,
				this.store,
				this.fsrsService,
			);

			const result = await importService.importApkg(this.fileData, {
				importScheduling: this.importScheduling,
				importMedia: this.importMedia,
				mediaFolder: this.mediaFolder,
			});

			this.renderResult(container, result);
		} catch (err) {
			container.empty();
			const errMsg = err instanceof Error ? err.message : String(err);
			container.createDiv({
				text: `Import failed: ${errMsg}`,
				cls: "ep:text-ui-small ep:text-red-500 ep:py-4 ep:text-center",
			});
			this.createButtonsSection(container, [
				{
					text: "Close",
					type: "secondary",
					onClick: () => this.close(),
				},
			]);
		}
	}

	private renderResult(
		container: HTMLElement,
		result: AnkiImportResult,
	): void {
		container.empty();

		this.updateTitle("Import complete");

		const summary = container.createDiv({
			cls: "ep:mb-4",
		});

		const stats = summary.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-2 ep:mb-4",
		});
		this.renderStatBadge(stats, "Imported", result.imported);
		this.renderStatBadge(stats, "Duplicates", result.duplicates);
		this.renderStatBadge(stats, "Skipped", result.skipped);
		this.renderStatBadge(stats, "Errors", result.errors.length);

		if (result.projects.length > 0) {
			const projectsEl = summary.createDiv({ cls: "ep:mb-3" });
			projectsEl.createDiv({
				text: "Projects created:",
				cls: "ep:text-ui-small ep:font-medium ep:mb-1",
			});
			projectsEl.createDiv({
				text: result.projects.join(", "),
				cls: "ep:text-ui-smaller ep:text-obs-muted",
			});
		}

		if (result.errors.length > 0) {
			const errSection = summary.createDiv({ cls: "ep:mb-3" });
			errSection.createDiv({
				text: "Errors:",
				cls: "ep:text-ui-small ep:font-medium ep:mb-1 ep:text-red-500",
			});
			const errList = errSection.createDiv({
				cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[100px] ep:overflow-y-auto ep:p-2",
			});
			for (const err of result.errors.slice(0, 20)) {
				errList.createDiv({
					text: err,
					cls: "ep:text-ui-smaller ep:text-obs-muted ep:py-0.5",
				});
			}
			if (result.errors.length > 20) {
				errList.createDiv({
					text: `...and ${result.errors.length - 20} more`,
					cls: "ep:text-ui-smaller ep:text-obs-muted ep:italic",
				});
			}
		}

		this.createButtonsSection(container, [
			{
				text: "Done",
				type: "primary",
				onClick: () => this.close(),
			},
		]);
	}

	private renderStatBadge(
		container: HTMLElement,
		label: string,
		count: number,
	): void {
		const badge = container.createDiv({
			cls: "ep:bg-obs-secondary ep:rounded-md ep:p-2 ep:text-center",
		});
		badge.createDiv({
			text: String(count),
			cls: "ep:text-lg ep:font-bold",
		});
		badge.createDiv({
			text: label,
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});
	}

	private renderCheckbox(
		container: HTMLElement,
		label: string,
		description: string,
		checked: boolean,
		onChange: (val: boolean) => void,
	): void {
		const row = container.createDiv({
			cls: "ep:flex ep:items-start ep:gap-3 ep:py-2",
		});

		const checkbox = row.createEl("input", {
			type: "checkbox",
			cls: "ep:w-4 ep:h-4 ep:accent-obs-interactive ep:shrink-0 ep:mt-0.5",
		});
		checkbox.checked = checked;
		this.addDomEvent(checkbox, "change", () => onChange(checkbox.checked));

		const textEl = row.createDiv();
		textEl.createDiv({
			text: label,
			cls: "ep:text-ui-small ep:font-medium",
		});
		textEl.createDiv({
			text: description,
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});
	}

	private getUniqueDecks(data: ApkgData): string[] {
		const names = new Set<string>();
		for (const [, deck] of data.decks) {
			if (deck.name !== "Default") {
				names.add(deck.name.replace(/::/g, "/"));
			}
		}
		return [...names].sort();
	}
}
