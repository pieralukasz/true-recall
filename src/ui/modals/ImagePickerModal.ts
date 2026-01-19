/**
 * Image Picker Modal
 * Modal for selecting images from vault or pasting from clipboard
 */
import { App, TFile, Notice, Component, MarkdownRenderer } from "obsidian";
import { BaseModal } from "./BaseModal";
import { ImageService } from "../../services/image";
import type { ImageInsertOptions } from "../../types";

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
export class ImagePickerModal extends BaseModal {
    private options: ImagePickerModalOptions;
    private imageService: ImageService;
    private resolvePromise: ((result: ImagePickerResult) => void) | null = null;

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

    /**
     * Open modal and wait for result
     */
    async openAndWait(): Promise<ImagePickerResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }

    onOpen(): void {
        super.onOpen();
        this.contentEl.addClass("episteme-image-picker-modal");

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
        this.renderButtons(container);
    }

    private renderPasteZone(container: HTMLElement): void {
        const zone = container.createDiv({ cls: "episteme-paste-zone" });

        const icon = zone.createDiv({ cls: "episteme-paste-icon" });
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

        zone.createDiv({
            text: "Paste image from clipboard",
            cls: "episteme-paste-text",
        });
        zone.createDiv({
            text: "Ctrl+V or drag & drop",
            cls: "episteme-paste-hint",
        });

        // Drag and drop handlers
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.addClass("episteme-paste-zone-active");
        });

        zone.addEventListener("dragleave", () => {
            zone.removeClass("episteme-paste-zone-active");
        });

        zone.addEventListener("drop", async (e) => {
            e.preventDefault();
            zone.removeClass("episteme-paste-zone-active");

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0]!;
                if (file.type.startsWith("image/")) {
                    await this.handleDroppedFile(file);
                } else {
                    new Notice("Please drop an image file");
                }
            }
        });
    }

    private renderRecentImages(container: HTMLElement): void {
        const section = container.createDiv({ cls: "episteme-recent-images-section" });

        section.createEl("h4", {
            text: "Recent Images",
            cls: "episteme-section-title",
        });

        const grid = section.createDiv({ cls: "episteme-image-grid" });

        const recentImages = this.imageService.getRecentImages(12);

        if (recentImages.length === 0) {
            grid.createDiv({
                text: "No images in vault",
                cls: "episteme-no-images",
            });
            return;
        }

        for (const file of recentImages) {
            const item = grid.createDiv({ cls: "episteme-image-item" });

            // Create thumbnail using Obsidian's resource path
            const img = item.createEl("img", {
                cls: "episteme-image-thumbnail",
                attr: {
                    src: this.app.vault.getResourcePath(file),
                    alt: file.basename,
                },
            });

            // Tooltip with filename
            item.setAttribute("title", file.name);

            // Size warning badge
            if (this.imageService.isFileTooLarge(file)) {
                const badge = item.createDiv({ cls: "episteme-size-warning" });
                badge.setText("Large");
            }

            // Click to select
            item.addEventListener("click", () => {
                this.selectImage(file);
                // Visual selection
                grid.querySelectorAll(".episteme-image-item").forEach(el =>
                    el.removeClass("selected")
                );
                item.addClass("selected");
            });
        }
    }

    private renderSizeControl(container: HTMLElement): void {
        const control = container.createDiv({ cls: "episteme-size-control" });

        control.createEl("label", {
            text: "Width:",
            cls: "episteme-size-label",
        });

        this.widthSlider = control.createEl("input", {
            cls: "episteme-width-slider",
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
            cls: "episteme-width-value",
        });

        this.widthSlider.addEventListener("input", () => {
            const value = parseInt(this.widthSlider!.value, 10);
            this.selectedWidth = value;
            this.widthValue!.setText(value === 0 ? "Auto" : `${value}px`);
            this.updatePreview();
        });
    }

    private renderPreviewSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: "episteme-preview-section" });

        section.createEl("h4", {
            text: "Preview",
            cls: "episteme-section-title",
        });

        this.previewContainer = section.createDiv({ cls: "episteme-image-preview" });
        this.previewContainer.createDiv({
            text: "Select or paste an image",
            cls: "episteme-preview-placeholder",
        });
    }

    private renderButtons(container: HTMLElement): void {
        const buttons = container.createDiv({ cls: "episteme-modal-buttons" });

        const cancelBtn = buttons.createEl("button", {
            text: "Cancel",
            cls: "episteme-btn episteme-btn-secondary",
        });
        cancelBtn.addEventListener("click", () => this.close());

        this.insertButton = buttons.createEl("button", {
            text: "Insert",
            cls: "episteme-btn episteme-btn-primary",
        });
        this.insertButton.disabled = true;
        this.insertButton.addEventListener("click", () => this.handleInsert());
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
            new Notice(`Image is too large (${size}). Maximum size is 5MB.`);
            return;
        }

        try {
            new Notice("Saving image...");
            const path = await this.imageService.saveImageFromClipboard(blob);
            const file = this.app.vault.getAbstractFileByPath(path);

            if (file instanceof TFile) {
                this.selectImage(file);
                new Notice("Image saved");
            }
        } catch (error) {
            console.error("[Episteme] Failed to save pasted image:", error);
            new Notice("Failed to save image");
        }
    }

    private async handleDroppedFile(file: File): Promise<void> {
        if (file.size > 5 * 1024 * 1024) {
            const size = this.imageService.formatFileSize(file.size);
            new Notice(`Image is too large (${size}). Maximum size is 5MB.`);
            return;
        }

        try {
            new Notice("Saving image...");
            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: file.type });
            const path = await this.imageService.saveImageFromClipboard(blob);
            const savedFile = this.app.vault.getAbstractFileByPath(path);

            if (savedFile instanceof TFile) {
                this.selectImage(savedFile);
                new Notice("Image saved");
            }
        } catch (error) {
            console.error("[Episteme] Failed to save dropped image:", error);
            new Notice("Failed to save image");
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
            cls: "episteme-preview-markdown",
        });

        // Show visual preview
        const previewEl = this.previewContainer.createDiv({ cls: "episteme-preview-render" });

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

        if (this.resolvePromise) {
            this.resolvePromise({
                cancelled: false,
                markdown,
            });
            this.resolvePromise = null;
        }

        this.close();
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

        if (this.resolvePromise) {
            this.resolvePromise({
                cancelled: true,
                markdown: "",
            });
            this.resolvePromise = null;
        }

        this.contentEl.empty();
    }
}
