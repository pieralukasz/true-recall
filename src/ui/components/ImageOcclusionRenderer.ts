/**
 * Image Occlusion Renderer
 * Displays image occlusion cards during review with SVG overlay
 */
import { App, Component } from "obsidian";
import type { ImageOcclusionData } from "../../types";
import { ImageOcclusionService } from "../../services";

export interface ImageOcclusionRendererOptions {
    /** The occlusion data */
    data: ImageOcclusionData;
    /** Whether the answer is currently revealed */
    revealed: boolean;
    /** App instance for loading images */
    app: App;
    /** Parent component for lifecycle management */
    component: Component;
}

/**
 * Renders an image occlusion card with SVG overlay
 */
export class ImageOcclusionRenderer {
    private containerEl: HTMLElement;
    private options: ImageOcclusionRendererOptions;
    private imageOcclusionService: ImageOcclusionService;
    private svgOverlay: SVGSVGElement | null = null;

    constructor(containerEl: HTMLElement, options: ImageOcclusionRendererOptions) {
        this.containerEl = containerEl;
        this.options = options;

        // We need a temporary FlashcardManager for the service
        // The service methods we use don't require it
        this.imageOcclusionService = new ImageOcclusionService(
            options.app,
            null as any // We only use methods that don't require flashcardManager
        );
    }

    /**
     * Render the image occlusion card
     */
    render(): void {
        const { data, revealed, app } = this.options;

        this.containerEl.empty();
        this.containerEl.addClass("episteme-io-review-container");

        // Question text (if any)
        if (data.questionText) {
            const questionEl = this.containerEl.createDiv({ cls: "episteme-io-question-text" });
            questionEl.textContent = data.questionText;
        }

        // Target hint for hide-one mode
        if (data.mode === "hide-one" && data.targetOcclusionId) {
            const target = data.occlusions.find(o => o.id === data.targetOcclusionId);
            if (target?.label) {
                const hintEl = this.containerEl.createDiv({ cls: "episteme-io-target-hint" });
                hintEl.textContent = `Identify region: ${target.label}`;
            }
        }

        // Image container
        const imageContainer = this.containerEl.createDiv({ cls: "episteme-io-image-container" });

        // Load and display image
        const resourcePath = this.imageOcclusionService.getImageResourcePath(data.imagePath);

        if (!resourcePath) {
            imageContainer.createEl("p", {
                text: "Image not found: " + data.imagePath,
                cls: "episteme-io-error",
            });
            return;
        }

        const imageEl = imageContainer.createEl("img", {
            cls: "episteme-io-image",
            attr: {
                src: resourcePath,
                alt: "Image occlusion",
            },
        });

        // Wait for image to load, then add SVG overlay
        imageEl.onload = () => {
            this.addSVGOverlay(imageContainer, data, revealed);
        };

        imageEl.onerror = () => {
            imageContainer.empty();
            imageContainer.createEl("p", {
                text: "Failed to load image",
                cls: "episteme-io-error",
            });
        };

        // Notes (shown when revealed)
        if (revealed && data.notes) {
            const notesEl = this.containerEl.createDiv({ cls: "episteme-io-notes" });
            notesEl.textContent = data.notes;
        }
    }

    /**
     * Add SVG overlay to image container
     */
    private addSVGOverlay(container: HTMLElement, data: ImageOcclusionData, revealed: boolean): void {
        const revealedIds = this.getRevealedIds(data, revealed);
        this.svgOverlay = this.imageOcclusionService.generateSVGOverlay(data, revealedIds, true);
        container.appendChild(this.svgOverlay);
    }

    /**
     * Update the reveal state (called when answer is shown/hidden)
     */
    setRevealed(revealed: boolean): void {
        this.options.revealed = revealed;

        if (this.svgOverlay) {
            const container = this.svgOverlay.parentElement;
            this.svgOverlay.remove();

            if (container) {
                const revealedIds = this.getRevealedIds(this.options.data, revealed);
                this.svgOverlay = this.imageOcclusionService.generateSVGOverlay(
                    this.options.data,
                    revealedIds,
                    true
                );
                container.appendChild(this.svgOverlay);
            }
        }
    }

    /**
     * Get IDs of occlusions to reveal based on mode
     */
    private getRevealedIds(data: ImageOcclusionData, isRevealed: boolean): string[] {
        if (!isRevealed) {
            // Not revealed - hide all except non-target in hide-one mode
            if (data.mode === "hide-one" && data.targetOcclusionId) {
                // In hide-one mode, show all EXCEPT the target when not revealed
                return data.occlusions
                    .filter(o => o.id !== data.targetOcclusionId)
                    .map(o => o.id);
            }
            return [];
        }

        // Revealed
        if (data.mode === "hide-all") {
            // Reveal all
            return data.occlusions.map(o => o.id);
        } else {
            // hide-one: reveal the target (and keep others revealed)
            return data.occlusions.map(o => o.id);
        }
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.containerEl.empty();
        this.svgOverlay = null;
    }
}
