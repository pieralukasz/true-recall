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
        this.mediaGridContainer = container.createDiv({ cls: "ep:flex ep:flex-col ep:gap-2" });
        this.renderMediaGrid();

        // Size control
        this.renderSizeControl(container);

        // Preview
        this.renderPreviewSection(container);

        // Buttons
        this.renderButtons(container);
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
            cls: "ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0",
        });

        const grid = this.mediaGridContainer.createDiv({ cls: "ep:grid ep:grid-cols-4 ep:gap-2 ep:max-h-[180px] ep:overflow-y-auto" });

        const mediaFiles = this.imageService.getRecentMedia(12);

        if (mediaFiles.length === 0) {
            grid.createDiv({
                text: "No media in vault",
                cls: "ep:text-center ep:text-obs-muted ep:py-6 ep:italic",
            });
            return;
        }

        for (const file of mediaFiles) {
            const item = grid.createDiv({ cls: "media-item ep:relative ep:aspect-square ep:rounded-md ep:overflow-hidden ep:cursor-pointer ep:border-2 ep:border-transparent ep:transition-all ep:hover:border-obs-interactive ep:hover:scale-[1.02]" });
            const isVideo = isVideoExtension(file.extension);

            if (isVideo) {
                // Video: show icon + filename - need flex column layout
                item.addClass("ep:flex", "ep:flex-col");
                const videoThumb = item.createDiv({ cls: "ep:flex ep:items-center ep:justify-center ep:w-full ep:h-[60%] ep:text-obs-muted" });
                videoThumb.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
                item.createDiv({
                    text: file.name,
                    cls: "ep:text-[11px] ep:text-obs-normal ep:text-center ep:p-1 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
                });
            } else {
                // Create thumbnail using Obsidian's resource path
                item.createEl("img", {
                    cls: "ep:w-full ep:h-full ep:object-cover",
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
                const badge = item.createDiv({ cls: "ep:absolute ep:top-1 ep:right-1 ep:py-0.5 ep:px-1.5 ep:bg-red-500 ep:text-white ep:text-[10px] ep:rounded" });
                badge.setText("Large");
            }

            // Click to select
            item.addEventListener("click", () => {
                this.selectFile(file);
                // Visual selection
                grid.querySelectorAll(".media-item").forEach(el =>
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
                value: "500",
            },
        });

        this.widthValue = control.createSpan({
            text: "500px",
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
            text: "Select or paste media",
            cls: "ep:text-obs-muted ep:italic ep:text-center ep:py-6",
        });
    }

    private renderButtons(container: HTMLElement): void {
        const buttons = container.createDiv({ cls: "ep:flex ep:justify-end ep:gap-3 ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border" });

        const cancelBtn = buttons.createEl("button", {
            text: "Cancel",
            cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-modifier-hover",
        });
        cancelBtn.addEventListener("click", () => this.close());

        this.insertButton = buttons.createEl("button", {
            text: "Insert",
            cls: "ep:py-2.5 ep:px-5 ep:bg-obs-interactive ep:text-white ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-interactive-hover ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
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
            cls: "ep:text-obs-muted ep:italic ep:text-center ep:py-6",
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
            cls: "ep:block ep:py-2 ep:px-3 ep:bg-obs-primary ep:rounded ep:text-ui-smaller ep:mb-2",
        });

        // Show visual preview
        const previewEl = this.previewContainer.createDiv({ cls: "ep:max-h-[200px] ep:overflow-auto" });

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
