/**
 * Image Occlusion Service
 * Handles creation and rendering of image occlusion flashcards
 */
import { App, TFile } from "obsidian";
import type { FlashcardManager } from "../flashcard/flashcard.service";
import type { FSRSFlashcardItem } from "../../types";
import {
    type ImageOcclusionData,
    type OcclusionItem,
    serializeImageOcclusionData,
    DEFAULT_OCCLUSION_COLOR,
} from "../../types";

export class ImageOcclusionService {
    constructor(
        private app: App,
        private flashcardManager: FlashcardManager
    ) {}

    /**
     * Create image occlusion cards from editor data
     * For hide-one mode: creates one card per occlusion
     * For hide-all mode: creates a single card
     */
    async createImageOcclusionCards(
        data: ImageOcclusionData,
        sourceFile: TFile,
        deck: string
    ): Promise<FSRSFlashcardItem[]> {
        const createdCards: FSRSFlashcardItem[] = [];

        // Get or create source UID
        const frontmatterService = this.flashcardManager.getFrontmatterService();
        let sourceUid = await frontmatterService.getSourceNoteUid(sourceFile);
        if (!sourceUid) {
            sourceUid = frontmatterService.generateUid();
            await frontmatterService.setSourceNoteUid(sourceFile, sourceUid);
        }

        if (data.mode === "hide-one") {
            // Create one card per occlusion
            for (const occ of data.occlusions) {
                const cardData: ImageOcclusionData = {
                    ...data,
                    targetOcclusionId: occ.id,
                };

                const question = serializeImageOcclusionData(cardData);
                const answer = `Reveal: ${occ.label || "region"}`;

                const card = await this.flashcardManager.addSingleFlashcardToSql(
                    question,
                    answer,
                    sourceUid,
                    deck
                );
                createdCards.push(card);
            }
        } else {
            // hide-all mode: single card
            const question = serializeImageOcclusionData(data);
            const answer = "Reveal all regions";

            const card = await this.flashcardManager.addSingleFlashcardToSql(
                question,
                answer,
                sourceUid,
                deck
            );
            createdCards.push(card);
        }

        return createdCards;
    }

    /**
     * Get image as a resource path for display
     */
    getImageResourcePath(imagePath: string): string {
        const file = this.app.vault.getAbstractFileByPath(imagePath);
        if (file instanceof TFile) {
            return this.app.vault.getResourcePath(file);
        }
        return "";
    }

    /**
     * Validate that an image exists and is a supported format
     */
    async validateImage(imagePath: string): Promise<{ valid: boolean; error?: string }> {
        const file = this.app.vault.getAbstractFileByPath(imagePath);

        if (!file) {
            return { valid: false, error: "Image file not found" };
        }

        if (!(file instanceof TFile)) {
            return { valid: false, error: "Path is not a file" };
        }

        const ext = file.extension.toLowerCase();
        const supportedFormats = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

        if (!supportedFormats.includes(ext)) {
            return { valid: false, error: `Unsupported format: ${ext}` };
        }

        return { valid: true };
    }

    /**
     * Get image dimensions by loading it
     */
    async getImageDimensions(imagePath: string): Promise<{ width: number; height: number } | null> {
        return new Promise((resolve) => {
            const resourcePath = this.getImageResourcePath(imagePath);
            if (!resourcePath) {
                resolve(null);
                return;
            }

            const img = new Image();
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                resolve(null);
            };
            img.src = resourcePath;
        });
    }

    /**
     * Find all images in a note's content
     * Returns array of vault-relative image paths
     */
    findImagesInNote(noteContent: string): string[] {
        const images: string[] = [];

        // Match ![[image.png]] and ![[folder/image.png]]
        const wikiLinkRegex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg))\]\]/gi;
        let match;

        while ((match = wikiLinkRegex.exec(noteContent)) !== null) {
            const imagePath = match[1];
            if (!imagePath) continue;
            // Remove any alias (e.g., ![[image.png|alt text]])
            const cleanPath = imagePath.split("|")[0]?.trim();
            if (cleanPath && !images.includes(cleanPath)) {
                images.push(cleanPath);
            }
        }

        // Also match markdown syntax ![alt](path.png)
        const mdImageRegex = /!\[([^\]]*)\]\(([^)]+\.(png|jpg|jpeg|gif|webp|svg))\)/gi;

        while ((match = mdImageRegex.exec(noteContent)) !== null) {
            const imagePath = match[2];
            if (imagePath && !images.includes(imagePath)) {
                images.push(imagePath);
            }
        }

        return images;
    }

    /**
     * Resolve a potentially relative image path to absolute vault path
     */
    resolveImagePath(imagePath: string, sourceFilePath: string): string {
        // If already absolute (starts with /)
        if (imagePath.startsWith("/")) {
            return imagePath.slice(1);
        }

        // Check if file exists at given path
        const directFile = this.app.vault.getAbstractFileByPath(imagePath);
        if (directFile instanceof TFile) {
            return imagePath;
        }

        // Try resolving relative to source file's folder
        const sourceFolder = sourceFilePath.substring(0, sourceFilePath.lastIndexOf("/"));
        const relativePath = sourceFolder ? `${sourceFolder}/${imagePath}` : imagePath;
        const relativeFile = this.app.vault.getAbstractFileByPath(relativePath);
        if (relativeFile instanceof TFile) {
            return relativePath;
        }

        // Try Obsidian's link resolution
        const resolved = this.app.metadataCache.getFirstLinkpathDest(imagePath, sourceFilePath);
        if (resolved instanceof TFile) {
            return resolved.path;
        }

        // Return original if nothing found
        return imagePath;
    }

    /**
     * Generate SVG overlay element for displaying occlusions
     * @param data - Image occlusion data
     * @param revealedIds - IDs of occlusions that should be revealed (transparent)
     * @param showLabels - Whether to show labels on hidden occlusions
     */
    generateSVGOverlay(
        data: ImageOcclusionData,
        revealedIds: string[],
        showLabels: boolean = true
    ): SVGSVGElement {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        svg.classList.add("episteme-io-overlay");

        for (const occ of data.occlusions) {
            const isRevealed = revealedIds.includes(occ.id);
            this.appendShapeToSVG(svg, occ, isRevealed, showLabels);
        }

        return svg;
    }

    /**
     * Append a shape element to the SVG
     */
    private appendShapeToSVG(
        svg: SVGSVGElement,
        occ: OcclusionItem,
        isRevealed: boolean,
        showLabels: boolean
    ): void {
        const color = occ.color || DEFAULT_OCCLUSION_COLOR;

        if (occ.shape.type === "rect") {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", String(occ.shape.x));
            rect.setAttribute("y", String(occ.shape.y));
            rect.setAttribute("width", String(occ.shape.width));
            rect.setAttribute("height", String(occ.shape.height));
            rect.setAttribute("fill", isRevealed ? "transparent" : color);
            rect.setAttribute("stroke", isRevealed ? "#22c55e" : "none");
            rect.setAttribute("stroke-width", isRevealed ? "0.5" : "0");
            rect.classList.add("episteme-io-shape");
            if (isRevealed) rect.classList.add("revealed");
            svg.appendChild(rect);

            // Add label if present and not revealed
            if (occ.label && showLabels && !isRevealed) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", String(occ.shape.x + occ.shape.width / 2));
                text.setAttribute("y", String(occ.shape.y + occ.shape.height / 2));
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("dominant-baseline", "middle");
                text.setAttribute("fill", "white");
                text.setAttribute("font-size", "4");
                text.setAttribute("font-weight", "bold");
                text.classList.add("episteme-io-label");
                text.textContent = occ.label;
                svg.appendChild(text);
            }
        } else if (occ.shape.type === "ellipse") {
            const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            ellipse.setAttribute("cx", String(occ.shape.cx));
            ellipse.setAttribute("cy", String(occ.shape.cy));
            ellipse.setAttribute("rx", String(occ.shape.rx));
            ellipse.setAttribute("ry", String(occ.shape.ry));
            ellipse.setAttribute("fill", isRevealed ? "transparent" : color);
            ellipse.setAttribute("stroke", isRevealed ? "#22c55e" : "none");
            ellipse.setAttribute("stroke-width", isRevealed ? "0.5" : "0");
            ellipse.classList.add("episteme-io-shape");
            if (isRevealed) ellipse.classList.add("revealed");
            svg.appendChild(ellipse);

            // Label for ellipse
            if (occ.label && showLabels && !isRevealed) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", String(occ.shape.cx));
                text.setAttribute("y", String(occ.shape.cy));
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("dominant-baseline", "middle");
                text.setAttribute("fill", "white");
                text.setAttribute("font-size", "4");
                text.setAttribute("font-weight", "bold");
                text.classList.add("episteme-io-label");
                text.textContent = occ.label;
                svg.appendChild(text);
            }
        } else if (occ.shape.type === "polygon") {
            const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const points = occ.shape.points.map(p => `${p.x},${p.y}`).join(" ");
            polygon.setAttribute("points", points);
            polygon.setAttribute("fill", isRevealed ? "transparent" : color);
            polygon.setAttribute("stroke", isRevealed ? "#22c55e" : "none");
            polygon.setAttribute("stroke-width", isRevealed ? "0.5" : "0");
            polygon.classList.add("episteme-io-shape");
            if (isRevealed) polygon.classList.add("revealed");
            svg.appendChild(polygon);
        }
    }

    /**
     * Get IDs of occlusions to reveal based on mode and target
     */
    getRevealedIds(data: ImageOcclusionData, isAnswerRevealed: boolean): string[] {
        if (!isAnswerRevealed) {
            return [];
        }

        if (data.mode === "hide-all") {
            // Reveal all occlusions
            return data.occlusions.map(o => o.id);
        } else {
            // hide-one mode: only reveal the target
            if (data.targetOcclusionId) {
                return [data.targetOcclusionId];
            }
            return [];
        }
    }

    /**
     * Get the target occlusion for a hide-one card
     */
    getTargetOcclusion(data: ImageOcclusionData): OcclusionItem | null {
        if (data.mode !== "hide-one" || !data.targetOcclusionId) {
            return null;
        }
        return data.occlusions.find(o => o.id === data.targetOcclusionId) || null;
    }
}
