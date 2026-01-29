/**
 * Image Picker Modal
 * Modal for selecting images from vault or pasting from clipboard
 */
import { App, TFile, Component, MarkdownRenderer } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";
import { ImageService } from "../../services/image";
import { notify } from "../../services";

export interface ImagePickerResult {
	cancelled: boolean;
	markdown: string;
}

interface ImagePickerModalOptions {
	/** Current file path for relative link resolution */
	currentFilePath: string;
}

/**
 * Modal for selecting/pasting images with size control
 */
export class ImagePickerModal extends BasePromiseModal<ImagePickerResult> {
	private options: ImagePickerModalOptions;
	private imageService: ImageService;

	// UI elements
	private previewContainer: HTMLElement | null = null;
	private widthSlider: HTMLInputElement | null = null;
	private widthValue: HTMLSpanElement | null = null;
	private insertButton: HTMLButtonElement | null = null;
	private renderComponent: Component | null = null;

	// State
	private selectedImage: TFile | null = null;
	private selectedWidth: number = 0; // 0 = auto

	constructor(app: App, options: ImagePickerModalOptions) {
		super(app, {
			title: "Insert Image",
			width: "550px",
		});
		this.options = options;
		this.imageService = new ImageService(app);
	}

	protected getDefaultResult(): ImagePickerResult {
		return { cancelled: true, markdown: "" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-image-picker-modal");

		// Initialize render component for preview
		this.renderComponent = new Component();
		this.renderComponent.load();

		// Setup paste handler on document
		this.setupPasteHandler();
	}

    protected renderBody(container: HTMLElement): void {
        // Paste zone
        this.renderPasteZone(container);

        // Recent images grid
        this.renderRecentImages(container);

        // Size control
        this.renderSizeControl(container);

        // Preview
        this.renderPreviewSection(container);

		// Buttons
		this.renderButtonsSection(container);
    }

    private renderPasteZone(container: HTMLElement): void {
        const zone = container.createDiv({ cls: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-6 ep:mb-4 ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive" });

        const icon = zone.createDiv({ cls: "ep:text-obs-muted" });
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

        zone.createDiv({
            text: "Paste image from clipboard",
            cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
        });
        zone.createDiv({
            text: "Ctrl+V or drag & drop",
            cls: "ep:text-ui-smaller ep:text-obs-muted",
        });

        // Drag and drop handlers
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.addClass("true-recall-paste-zone-active");
        });

        zone.addEventListener("dragleave", () => {
            zone.removeClass("true-recall-paste-zone-active");
        });

        zone.addEventListener("drop", async (e) => {
            e.preventDefault();
            zone.removeClass("true-recall-paste-zone-active");

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0]!;
                if (file.type.startsWith("image/")) {
                    await this.handleDroppedFile(file);
                } else {
                    notify().warning("Please drop an image file");
                }
            }
        });
    }

    private renderRecentImages(container: HTMLElement): void {
        const section = container.createDiv({ cls: "ep:flex ep:flex-col ep:gap-2" });

        section.createEl("h4", {
            text: "Recent Images",
            cls: "ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0",
        });

        const grid = section.createDiv({ cls: "ep:grid ep:grid-cols-4 ep:gap-2 ep:max-h-[180px] ep:overflow-y-auto" });

        const recentImages = this.imageService.getRecentImages(12);

        if (recentImages.length === 0) {
            grid.createDiv({
                text: "No images in vault",
                cls: "ep:text-center ep:text-obs-muted ep:py-6 ep:italic",
            });
            return;
        }

        for (const file of recentImages) {
            const item = grid.createDiv({ cls: "ep:relative ep:aspect-square ep:rounded-md ep:overflow-hidden ep:cursor-pointer ep:border-2 ep:border-transparent ep:transition-all ep:hover:border-obs-interactive ep:hover:scale-[1.02]" });

            // Create thumbnail using Obsidian's resource path
            const img = item.createEl("img", {
                cls: "ep:w-full ep:h-full ep:object-cover",
                attr: {
                    src: this.app.vault.getResourcePath(file),
                    alt: file.basename,
                },
            });

            // Tooltip with filename
            item.setAttribute("title", file.name);

            // Size warning badge
            if (this.imageService.isFileTooLarge(file)) {
                const badge = item.createDiv({ cls: "ep:absolute ep:top-1 ep:right-1 ep:py-0.5 ep:px-1.5 ep:bg-red-500 ep:text-white ep:text-[10px] ep:rounded" });
                badge.setText("Large");
            }

            // Click to select
            item.addEventListener("click", () => {
                this.selectImage(file);
                // Visual selection
                grid.querySelectorAll("[class*='ep:aspect-square']").forEach(el =>
                    el.classList.remove("ep:border-obs-interactive", "ep:shadow-[0_0_0_2px_rgba(var(--interactive-accent-rgb),0.3)]")
                );
                item.classList.add("ep:border-obs-interactive", "ep:shadow-[0_0_0_2px_rgba(var(--interactive-accent-rgb),0.3)]");
            });
        }
    }

    private renderSizeControl(container: HTMLElement): void {
        const control = container.createDiv({ cls: "ep:flex ep:items-center ep:gap-3 ep:p-3 ep:bg-obs-secondary ep:rounded-md" });

        control.createEl("label", {
            text: "Width:",
            cls: "ep:text-ui-small ep:font-medium ep:text-obs-normal",
        });

        this.widthSlider = control.createEl("input", {
            cls: "ep:flex-1 ep:h-1 ep:accent-obs-interactive",
            attr: {
                type: "range",
                min: "0",
                max: "800",
                step: "50",
                value: "0",
            },
        });

        this.widthValue = control.createSpan({
            text: "Auto",
            cls: "ep:text-ui-small ep:font-medium ep:text-obs-interactive ep:min-w-[50px] ep:text-right",
        });

        this.widthSlider.addEventListener("input", () => {
            const value = parseInt(this.widthSlider!.value, 10);
            this.selectedWidth = value;
            this.widthValue!.setText(value === 0 ? "Auto" : `${value}px`);
            this.updatePreview();
        });
    }

    private renderPreviewSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: "ep:flex ep:flex-col ep:gap-2" });

        section.createEl("h4", {
            text: "Preview",
            cls: "ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0",
        });

        this.previewContainer = section.createDiv({ cls: "ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:min-h-[100px] ep:overflow-hidden" });
        this.previewContainer.createDiv({
            text: "Select or paste an image",
            cls: "ep:text-obs-muted ep:italic ep:text-center ep:py-6",
        });
    }

	private renderButtonsSection(container: HTMLElement): void {
		const buttonsEl = this.createButtonsSection(container, [
			{ text: "Cancel", type: "secondary", onClick: () => this.close() },
			{
				text: "Insert",
				type: "primary",
				onClick: () => this.handleInsert(),
				disabled: true,
			},
		]);

		// Store reference to insert button for enabling later
		this.insertButton = buttonsEl.querySelector(
			"button:last-child"
		) as HTMLButtonElement;
	}

    // Store paste handler reference for cleanup
    private pasteHandler: ((e: ClipboardEvent) => void) | null = null;

    private setupPasteHandler(): void {
        this.pasteHandler = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item && item.type.startsWith("image/")) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (blob) {
                        await this.handlePastedImage(blob);
                    }
                    return;
                }
            }
        };

        document.addEventListener("paste", this.pasteHandler);
    }

    private async handlePastedImage(blob: Blob): Promise<void> {
        if (this.imageService.isBlobTooLarge(blob)) {
            const size = this.imageService.formatFileSize(blob.size);
            notify().imageTooLarge(size);
            return;
        }

        try {
            notify().imageSaving();
            const path = await this.imageService.saveImageFromClipboard(blob);
            const file = this.app.vault.getAbstractFileByPath(path);

            if (file instanceof TFile) {
                this.selectImage(file);
                notify().imageSaved();
            }
        } catch (error) {
            console.error("[True Recall] Failed to save pasted image:", error);
            notify().operationFailed("save image", error);
        }
    }

    private async handleDroppedFile(file: File): Promise<void> {
        if (file.size > 5 * 1024 * 1024) {
            const size = this.imageService.formatFileSize(file.size);
            notify().imageTooLarge(size);
            return;
        }

        try {
            notify().imageSaving();
            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: file.type });
            const path = await this.imageService.saveImageFromClipboard(blob);
            const savedFile = this.app.vault.getAbstractFileByPath(path);

            if (savedFile instanceof TFile) {
                this.selectImage(savedFile);
                notify().imageSaved();
            }
        } catch (error) {
            console.error("[True Recall] Failed to save dropped image:", error);
            notify().operationFailed("save image", error);
        }
    }

    private selectImage(file: TFile): void {
        this.selectedImage = file;
        this.insertButton!.disabled = false;
        this.updatePreview();
    }

    private updatePreview(): void {
        if (!this.previewContainer || !this.selectedImage || !this.renderComponent) return;

        this.previewContainer.empty();

        const markdown = this.imageService.buildImageMarkdown(
            this.selectedImage.path,
            this.selectedWidth > 0 ? this.selectedWidth : undefined
        );

        // Show the markdown that will be inserted
        const codeEl = this.previewContainer.createEl("code", {
            text: markdown,
            cls: "ep:block ep:py-2 ep:px-3 ep:bg-obs-primary ep:rounded ep:text-ui-smaller ep:mb-2",
        });

        // Show visual preview
        const previewEl = this.previewContainer.createDiv({ cls: "ep:max-h-[200px] ep:overflow-auto" });

        MarkdownRenderer.render(
            this.app,
            markdown,
            previewEl,
            this.options.currentFilePath,
            this.renderComponent
        );
    }

	private handleInsert(): void {
		if (!this.selectedImage) return;

		const markdown = this.imageService.buildImageMarkdown(
			this.selectedImage.path,
			this.selectedWidth > 0 ? this.selectedWidth : undefined
		);

		this.resolve({ cancelled: false, markdown });
	}

	onClose(): void {
		// Clean up paste handler
		if (this.pasteHandler) {
			document.removeEventListener("paste", this.pasteHandler);
			this.pasteHandler = null;
		}

		if (this.renderComponent) {
			this.renderComponent.unload();
			this.renderComponent = null;
		}

		// Let BasePromiseModal handle the promise resolution
		super.onClose();
	}
}
