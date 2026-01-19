/**
 * Media Picker Modal
 * Modal for selecting images or videos from vault with size control
 */
import { App, TFile, Notice, Component, MarkdownRenderer } from "obsidian";
import { BaseModal } from "./BaseModal";
import { ImageService } from "../../services/image";
import { isVideoExtension } from "../../types";

export interface MediaPickerResult {
    cancelled: boolean;
    markdown: string;
}

interface MediaPickerModalOptions {
    /** Current file path for relative link resolution */
    currentFilePath: string;
}

/**
 * Modal for selecting/pasting media (images/videos) with size control
 */
export class MediaPickerModal extends BaseModal {
    private options: MediaPickerModalOptions;
    private imageService: ImageService;
    private resolvePromise: ((result: MediaPickerResult) => void) | null = null;

    // UI elements
    private mediaGridContainer: HTMLElement | null = null;
    private previewContainer: HTMLElement | null = null;
    private widthSlider: HTMLInputElement | null = null;
    private widthValue: HTMLSpanElement | null = null;
    private insertButton: HTMLButtonElement | null = null;
    private renderComponent: Component | null = null;

    // State
    private selectedFile: TFile | null = null;
    private selectedWidth: number = 500; // default 500px

    constructor(app: App, options: MediaPickerModalOptions) {
        super(app, {
            title: "Insert Media",
            width: "550px",
        });
        this.options = options;
        this.imageService = new ImageService(app);
    }

    /**
     * Open modal and wait for result
     */
    async openAndWait(): Promise<MediaPickerResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }

    onOpen(): void {
        super.onOpen();
        this.contentEl.addClass("episteme-media-picker-modal");

        // Initialize render component for preview
        this.renderComponent = new Component();
        this.renderComponent.load();

        // Setup paste handler on document
        this.setupPasteHandler();
    }

    protected renderBody(container: HTMLElement): void {
        // Paste zone
        this.renderPasteZone(container);

        // Media grid container (will be populated based on tab)
        this.mediaGridContainer = container.createDiv({ cls: "episteme-recent-media-section" });
        this.renderMediaGrid();

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

    private renderMediaGrid(): void {
        if (!this.mediaGridContainer) return;

        this.mediaGridContainer.empty();

        this.mediaGridContainer.createEl("h4", {
            text: "Recent Media",
            cls: "episteme-section-title",
        });

        const grid = this.mediaGridContainer.createDiv({ cls: "episteme-image-grid" });

        const mediaFiles = this.imageService.getRecentMedia(12);

        if (mediaFiles.length === 0) {
            grid.createDiv({
                text: "No media in vault",
                cls: "episteme-no-images",
            });
            return;
        }

        for (const file of mediaFiles) {
            const item = grid.createDiv({ cls: "episteme-image-item" });
            const isVideo = isVideoExtension(file.extension);

            if (isVideo) {
                // Video: show icon + filename
                const videoThumb = item.createDiv({ cls: "episteme-video-thumbnail" });
                videoThumb.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                item.createDiv({
                    text: file.name,
                    cls: "episteme-video-name",
                });
            } else {
                // Create thumbnail using Obsidian's resource path
                item.createEl("img", {
                    cls: "episteme-image-thumbnail",
                    attr: {
                        src: this.app.vault.getResourcePath(file),
                        alt: file.basename,
                    },
                });
            }

            // Tooltip with filename
            item.setAttribute("title", file.name);

            // Size warning badge
            const isTooLarge = isVideo
                ? this.imageService.isVideoTooLarge(file)
                : this.imageService.isFileTooLarge(file);

            if (isTooLarge) {
                const badge = item.createDiv({ cls: "episteme-size-warning" });
                badge.setText("Large");
            }

            // Click to select
            item.addEventListener("click", () => {
                this.selectFile(file);
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
                value: "500",
            },
        });

        this.widthValue = control.createSpan({
            text: "500px",
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
            text: "Select or paste media",
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
                this.selectFile(file);
                this.renderMediaGrid(); // Refresh grid to show new image
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
                this.selectFile(savedFile);
                this.renderMediaGrid(); // Refresh grid to show new image
                new Notice("Image saved");
            }
        } catch (error) {
            console.error("[Episteme] Failed to save dropped image:", error);
            new Notice("Failed to save image");
        }
    }

    private selectFile(file: TFile): void {
        this.selectedFile = file;
        this.insertButton!.disabled = false;
        this.updatePreview();
    }

    private clearPreview(): void {
        if (!this.previewContainer) return;

        this.previewContainer.empty();
        this.previewContainer.createDiv({
            text: "Select or paste media",
            cls: "episteme-preview-placeholder",
        });
    }

    private updatePreview(): void {
        if (!this.previewContainer || !this.selectedFile || !this.renderComponent) return;

        this.previewContainer.empty();

        const isVideo = isVideoExtension(this.selectedFile.extension);
        const width = this.selectedWidth > 0 ? this.selectedWidth : undefined;

        let markdown: string;
        if (isVideo) {
            markdown = this.imageService.buildVideoHtml(this.selectedFile, width);
        } else {
            markdown = this.imageService.buildImageMarkdown(this.selectedFile.path, width);
        }

        // Show the markdown/HTML that will be inserted
        this.previewContainer.createEl("code", {
            text: markdown,
            cls: "episteme-preview-markdown",
        });

        // Show visual preview
        const previewEl = this.previewContainer.createDiv({ cls: "episteme-preview-render" });

        if (isVideo) {
            // For video, directly render HTML (MarkdownRenderer won't handle <video> well)
            previewEl.innerHTML = markdown;
        } else {
            MarkdownRenderer.render(
                this.app,
                markdown,
                previewEl,
                this.options.currentFilePath,
                this.renderComponent
            );
        }
    }

    private handleInsert(): void {
        if (!this.selectedFile) return;

        const isVideo = isVideoExtension(this.selectedFile.extension);
        const width = this.selectedWidth > 0 ? this.selectedWidth : undefined;

        let markdown: string;
        if (isVideo) {
            markdown = this.imageService.buildVideoHtml(this.selectedFile, width);
        } else {
            markdown = this.imageService.buildImageMarkdown(this.selectedFile.path, width);
        }

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
