/**
 * Batch Import Modal
 * Allows importing multiple flashcards at once by pasting text
 * AI parses the text into Q/A format (without modifying content)
 * Also supports pasting images to create photo flashcards
 */
import { App, setIcon } from "obsidian";
import { BaseModal } from "./BaseModal";
import { FlashcardReviewModal } from "./FlashcardReviewModal";
import { MediaPickerModal } from "./MediaPickerModal";
import { notify, FlashcardParserService, type OpenRouterService } from "../../services";
import { ImageService } from "../../services/image";
import type { FlashcardItem, TrueRecallSettings } from "../../types";
import { BATCH_IMPORT_PARSE_PROMPT } from "../../constants";

export interface BatchImportResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];
}

export interface BatchImportModalOptions {
	openRouterService: OpenRouterService;
	settings: TrueRecallSettings;
	/** Current file path for image saving */
	currentFilePath?: string;
}

/**
 * Modal for batch importing flashcards from pasted text
 */
export class BatchImportModal extends BaseModal {
	private options: BatchImportModalOptions;
	private resolvePromise: ((result: BatchImportResult) => void) | null = null;
	private hasSelected = false;

	// UI refs
	private contentTextarea: HTMLTextAreaElement | null = null;
	private parseButton: HTMLButtonElement | null = null;
	private isParsing = false;

	// Image service
	private imageService: ImageService | null = null;

	// Photo flashcards (added via paste/picker)
	private photoFlashcards: FlashcardItem[] = [];
	private photoListEl: HTMLElement | null = null;

	constructor(app: App, options: BatchImportModalOptions) {
		super(app, {
			title: "Batch Import Flashcards",
			width: "600px",
		});
		this.options = options;
	}

	async openAndWait(): Promise<BatchImportResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		// Initialize image service before super.onOpen() which calls renderBody()
		this.imageService = new ImageService(this.app);

		super.onOpen();
		this.contentEl.addClass("true-recall-batch-import-modal");

		// Setup paste handler on document
		this.setupPasteHandler();
	}

	protected renderBody(container: HTMLElement): void {
		// Photo paste zone
		this.renderPhotoPasteZone(container);

		// Instructions section
		const instructionsEl = container.createDiv({
			cls: "ep:mb-3 ep:text-ui-smaller ep:text-obs-muted",
		});
		instructionsEl.innerHTML = `
			Paste your flashcards below. Supported formats:
			<ul class="ep:mt-1 ep:pl-4 ep:list-disc">
				<li>Question #flashcard followed by answer</li>
				<li>Q: Question / A: Answer</li>
				<li>Numbered lists with answers below</li>
				<li>Tab-separated Q&A pairs</li>
			</ul>
		`;

		// Textarea section
		const textareaSection = container.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2",
		});

		this.contentTextarea = textareaSection.createEl("textarea", {
			cls: "ep:w-full ep:min-h-64 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:font-mono ep:text-ui-small ep:resize-y ep:leading-normal ep:focus:outline-none ep:focus:border-obs-interactive ep:disabled:opacity-60 ep:disabled:cursor-not-allowed ep:disabled:bg-obs-secondary ep:placeholder:text-obs-muted ep:placeholder:text-sm",
			attr: {
				placeholder: `Q: What is photosynthesis?
A: The process plants use to convert sunlight into energy

OR

What is photosynthesis? #flashcard
The process plants use to convert sunlight into energy`,
				rows: "12",
			},
		});

		// Focus textarea on open
		setTimeout(() => this.contentTextarea?.focus(), 50);

		// Keyboard shortcut hint
		const hintEl = textareaSection.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:text-right",
		});
		hintEl.innerHTML = `<span class="ep:inline-block ep:py-0.5 ep:px-1.5 ep:bg-obs-border ep:rounded ep:text-obs-muted ep:font-mono ep:text-[9px]">⌘ + Enter</span> to parse`;

		// Handle Cmd/Ctrl+Enter shortcut
		this.contentTextarea.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				void this.handleParse();
			}
		});

		// Buttons section
		const buttonsSection = container.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:mt-4 ep:border-t ep:border-obs-border",
		});

		const cancelBtn = buttonsSection.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover",
		});
		cancelBtn.addEventListener("click", () => this.handleCancel());

		this.parseButton = buttonsSection.createEl("button", {
			text: "Parse with AI",
			cls: "mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
		});
		this.parseButton.addEventListener("click", () => void this.handleParse());
	}

	/**
	 * Render photo paste zone at the top
	 */
	private renderPhotoPasteZone(container: HTMLElement): void {
		const zoneWrapper = container.createDiv({ cls: "ep:mb-4" });

		// Paste zone
		const zone = zoneWrapper.createDiv({
			cls: "ep:flex ep:items-center ep:justify-center ep:gap-3 ep:p-4 ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:hover:bg-obs-secondary/30",
		});

		const iconEl = zone.createDiv({ cls: "ep:text-obs-muted" });
		setIcon(iconEl, "image-plus");

		const textWrapper = zone.createDiv({ cls: "ep:flex ep:flex-col" });
		textWrapper.createDiv({
			text: "Add photo flashcard",
			cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
		});
		textWrapper.createDiv({
			text: "Paste image (Ctrl+V) or click to browse",
			cls: "ep:text-ui-smaller ep:text-obs-muted",
		});

		// Click to open media picker
		zone.addEventListener("click", () => void this.openMediaPicker());

		// Drag and drop handlers
		zone.addEventListener("dragover", (e) => {
			e.preventDefault();
			zone.addClass("ep:border-obs-interactive", "ep:bg-obs-secondary/50");
		});

		zone.addEventListener("dragleave", () => {
			zone.removeClass("ep:border-obs-interactive", "ep:bg-obs-secondary/50");
		});

		zone.addEventListener("drop", (e) => {
			e.preventDefault();
			zone.removeClass("ep:border-obs-interactive", "ep:bg-obs-secondary/50");
			void this.handleDrop(e);
		});

		// Photo list (shows added photo flashcards)
		this.photoListEl = zoneWrapper.createDiv({ cls: "ep:flex ep:flex-col ep:gap-2 ep:mt-2" });
	}

	/**
	 * Setup paste handler for images
	 */
	private setupPasteHandler(): void {
		const pasteHandler = (e: ClipboardEvent) => {
			// Check if there's an image in the clipboard
			const items = e.clipboardData?.items;
			if (!items) return;

			for (const item of Array.from(items)) {
				if (item.type.startsWith("image/")) {
					e.preventDefault();
					const file = item.getAsFile();
					if (file) {
						void this.handleImageFile(file);
					}
					return;
				}
			}
		};

		this.contentEl.addEventListener("paste", pasteHandler);
	}

	/**
	 * Handle dropped files
	 */
	private async handleDrop(e: DragEvent): Promise<void> {
		const files = e.dataTransfer?.files;
		if (!files) return;

		for (const file of Array.from(files)) {
			if (file.type.startsWith("image/")) {
				await this.handleImageFile(file);
			}
		}
	}

	/**
	 * Handle pasted/dropped image file
	 */
	private async handleImageFile(file: File): Promise<void> {
		if (!this.imageService) return;

		try {
			// Save image to vault - returns the file path
			const savedPath = await this.imageService.saveImageFromClipboard(file);
			if (!savedPath) {
				notify().warning("Failed to save image");
				return;
			}

			// Create photo flashcard using image service to build markdown
			const markdown = this.imageService.buildImageMarkdown(savedPath, 500);
			this.addPhotoFlashcard(markdown);

		} catch (error) {
			console.error("Error saving image:", error);
			notify().operationFailed("save image", error);
		}
	}

	/**
	 * Open media picker modal
	 */
	private async openMediaPicker(): Promise<void> {
		const modal = new MediaPickerModal(this.app, {
			currentFilePath: this.options.currentFilePath || "",
		});

		const result = await modal.openAndWait();

		if (!result.cancelled && result.markdown) {
			this.addPhotoFlashcard(result.markdown);
		}
	}

	/**
	 * Add a photo flashcard to the list
	 */
	private addPhotoFlashcard(imageMarkdown: string): void {
		const flashcard: FlashcardItem = {
			id: crypto.randomUUID(),
			question: imageMarkdown,
			answer: "photo:",
		};

		this.photoFlashcards.push(flashcard);
		this.renderPhotoList();
	}

	/**
	 * Render the list of photo flashcards
	 */
	private renderPhotoList(): void {
		if (!this.photoListEl) return;
		this.photoListEl.empty();

		if (this.photoFlashcards.length === 0) return;

		for (let i = 0; i < this.photoFlashcards.length; i++) {
			const card = this.photoFlashcards[i];
			const itemEl = this.photoListEl.createDiv({
				cls: "ep:flex ep:items-center ep:gap-2 ep:p-2 ep:bg-obs-secondary ep:rounded-md",
			});

			const iconEl = itemEl.createDiv({ cls: "ep:text-obs-muted ep:shrink-0" });
			setIcon(iconEl, "image");

			itemEl.createDiv({
				text: `Photo flashcard ${i + 1}`,
				cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal ep:truncate",
			});

			const removeBtn = itemEl.createEl("button", {
				cls: "clickable-icon ep:text-obs-muted ep:hover:text-obs-normal",
				attr: { "aria-label": "Remove" },
			});
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				this.photoFlashcards.splice(i, 1);
				this.renderPhotoList();
			});
		}
	}

	private async handleParse(): Promise<void> {
		const content = this.contentTextarea?.value.trim();
		const hasTextContent = content && content.length > 0;
		const hasPhotoContent = this.photoFlashcards.length > 0;

		if (!hasTextContent && !hasPhotoContent) {
			notify().warning("Please paste some flashcard content or add photos first");
			return;
		}

		if (this.isParsing) return;

		this.setParsing(true);

		try {
			let parsedFlashcards: FlashcardItem[] = [];

			// Parse text content if present
			if (hasTextContent) {
				const response = await this.options.openRouterService.generateFlashcards(
					content,
					undefined,
					BATCH_IMPORT_PARSE_PROMPT
				);

				const parser = new FlashcardParserService();
				parsedFlashcards = parser.extractFlashcards(response);
			}

			// Combine with photo flashcards
			const allFlashcards = [...this.photoFlashcards, ...parsedFlashcards];

			if (allFlashcards.length === 0) {
				notify().warning("No flashcards could be parsed. Please check the format.");
				this.setParsing(false);
				return;
			}

			// Open review modal for editing before save
			const reviewModal = new FlashcardReviewModal(this.app, {
				initialFlashcards: allFlashcards,
				openRouterService: this.options.openRouterService,
				settings: this.options.settings,
			});

			const reviewResult = await reviewModal.openAndWait();

			if (reviewResult.cancelled || !reviewResult.flashcards?.length) {
				// User cancelled review - go back to import modal
				this.setParsing(false);
				return;
			}

			// Return approved flashcards
			this.resolve({
				cancelled: false,
				flashcards: reviewResult.flashcards,
			});

		} catch (error) {
			console.error("Error parsing flashcards:", error);
			notify().operationFailed("parse flashcards", error);
			this.setParsing(false);
		}
	}

	private setParsing(parsing: boolean): void {
		this.isParsing = parsing;
		if (this.parseButton) {
			this.parseButton.disabled = parsing;
			this.parseButton.textContent = parsing ? "Parsing..." : "Parse with AI";
		}
		if (this.contentTextarea) {
			this.contentTextarea.disabled = parsing;
		}
	}

	private resolve(result: BatchImportResult): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(result);
			this.resolvePromise = null;
		}
		this.close();
	}

	private handleCancel(): void {
		this.resolve({ cancelled: true });
	}

	onClose(): void {
		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({ cancelled: true });
			this.resolvePromise = null;
		}
		this.contentEl.empty();
	}
}
