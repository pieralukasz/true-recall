/**
 * Image Occlusion Editor Modal
 * Canvas-based editor for creating image occlusion flashcards
 * Supports drawing rectangles, selecting, and managing occlusions
 */
import { App } from "obsidian";
import { BaseModal } from "./BaseModal";
import type {
    ImageOcclusionData,
    ImageOcclusionEditorResult,
    OcclusionItem,
    OcclusionMode,
    RectShape,
} from "../../types";
import {
    generateOcclusionId,
    createRectShape,
    DEFAULT_OCCLUSION_COLOR,
    MIN_SHAPE_SIZE,
} from "../../types";

type EditorTool = "rect" | "select";

interface Point {
    x: number;
    y: number;
}

export interface ImageOcclusionEditorOptions {
    /** Path to the image file (vault-relative) */
    imagePath: string;
    /** Resource path for loading the image */
    imageResourcePath: string;
    /** Existing occlusion data for editing (optional) */
    existingData?: ImageOcclusionData;
}

/**
 * Modal for creating and editing image occlusions
 */
export class ImageOcclusionEditorModal extends BaseModal {
    private options: ImageOcclusionEditorOptions;
    private resolvePromise: ((result: ImageOcclusionEditorResult) => void) | null = null;
    private hasSubmitted = false;

    // Canvas elements
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    // Image state
    private image: HTMLImageElement | null = null;
    private imageLoaded = false;
    private imageWidth = 0;
    private imageHeight = 0;

    // Drawing state
    private currentTool: EditorTool = "rect";
    private isDrawing = false;
    private startPoint: Point | null = null;
    private currentPoint: Point | null = null;

    // Occlusions
    private occlusions: OcclusionItem[] = [];
    private selectedOcclusionId: string | null = null;

    // Undo/redo
    private undoStack: OcclusionItem[][] = [];
    private redoStack: OcclusionItem[][] = [];

    // Mode
    private mode: OcclusionMode = "hide-one";

    // Label counter
    private labelCounter = 1;

    constructor(app: App, options: ImageOcclusionEditorOptions) {
        super(app, {
            title: "Image Occlusion Editor",
            width: "90vw",
        });
        this.options = options;

        // Load existing data if provided
        if (options.existingData) {
            this.occlusions = [...options.existingData.occlusions];
            this.mode = options.existingData.mode;
            this.labelCounter = this.occlusions.length + 1;
        }
    }

    /**
     * Open modal and return promise with result
     */
    async openAndWait(): Promise<ImageOcclusionEditorResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }

    onOpen(): void {
        super.onOpen();
        this.contentEl.addClass("episteme-io-editor-modal");

        // Set max height for modal
        this.modalEl.style.maxHeight = "90vh";
    }

    protected renderBody(container: HTMLElement): void {
        const editorContainer = container.createDiv({ cls: "episteme-io-editor-container" });

        // Toolbar
        this.renderToolbar(editorContainer);

        // Main content (canvas + sidebar)
        const mainContent = editorContainer.createDiv({ cls: "episteme-io-main-content" });

        // Canvas container
        const canvasContainer = mainContent.createDiv({ cls: "episteme-io-canvas-container" });
        this.setupCanvas(canvasContainer);

        // Sidebar
        this.renderSidebar(mainContent);

        // Footer with buttons
        this.renderFooter(editorContainer);

        // Load image
        this.loadImage();

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts(container);
    }

    private renderToolbar(container: HTMLElement): void {
        const toolbar = container.createDiv({ cls: "episteme-io-toolbar" });

        // Tool buttons
        const tools: Array<{ id: EditorTool; label: string; title: string }> = [
            { id: "rect", label: "Rectangle", title: "Draw rectangle (R)" },
            { id: "select", label: "Select", title: "Select & move (V)" },
        ];

        for (const tool of tools) {
            const btn = toolbar.createEl("button", {
                text: tool.label,
                cls: `episteme-io-tool-btn ${this.currentTool === tool.id ? "active" : ""}`,
                attr: { title: tool.title, "data-tool": tool.id },
            });
            btn.addEventListener("click", () => this.setTool(tool.id));
        }

        // Separator
        toolbar.createDiv({ cls: "episteme-io-toolbar-separator" });

        // Undo/Redo buttons
        const undoBtn = toolbar.createEl("button", {
            text: "Undo",
            cls: "episteme-io-tool-btn",
            attr: { title: "Undo (Cmd+Z)" },
        });
        undoBtn.addEventListener("click", () => this.undo());

        const redoBtn = toolbar.createEl("button", {
            text: "Redo",
            cls: "episteme-io-tool-btn",
            attr: { title: "Redo (Cmd+Y)" },
        });
        redoBtn.addEventListener("click", () => this.redo());

        // Separator
        toolbar.createDiv({ cls: "episteme-io-toolbar-separator" });

        // Delete button
        const deleteBtn = toolbar.createEl("button", {
            text: "Delete",
            cls: "episteme-io-tool-btn episteme-io-tool-btn-danger",
            attr: { title: "Delete selected (Del)" },
        });
        deleteBtn.addEventListener("click", () => this.deleteSelected());
    }

    private setupCanvas(container: HTMLElement): void {
        this.canvas = container.createEl("canvas", { cls: "episteme-io-canvas" });
        this.ctx = this.canvas.getContext("2d");

        // Mouse events
        this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
        this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));

        // Touch events for mobile
        this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this), { passive: false });
    }

    private loadImage(): void {
        this.image = new Image();
        this.image.onload = () => {
            this.imageLoaded = true;
            this.imageWidth = this.image!.naturalWidth;
            this.imageHeight = this.image!.naturalHeight;
            this.resizeCanvas();
            this.redraw();
        };
        this.image.onerror = () => {
            console.error("Failed to load image:", this.options.imagePath);
        };
        this.image.src = this.options.imageResourcePath;
    }

    private resizeCanvas(): void {
        if (!this.canvas || !this.imageLoaded) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        // Calculate dimensions maintaining aspect ratio
        const maxWidth = container.clientWidth - 20;
        const maxHeight = window.innerHeight * 0.6;

        const aspectRatio = this.imageWidth / this.imageHeight;

        let canvasWidth = maxWidth;
        let canvasHeight = canvasWidth / aspectRatio;

        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;
    }

    private redraw(): void {
        if (!this.ctx || !this.canvas || !this.imageLoaded || !this.image) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw image
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);

        // Draw existing occlusions
        for (const occ of this.occlusions) {
            this.drawOcclusion(occ, occ.id === this.selectedOcclusionId);
        }

        // Draw current drawing preview
        if (this.isDrawing && this.startPoint && this.currentPoint && this.currentTool === "rect") {
            this.drawPreviewRect(this.startPoint, this.currentPoint);
        }
    }

    private drawOcclusion(occ: OcclusionItem, selected: boolean): void {
        if (!this.ctx || !this.canvas) return;

        const color = occ.color || DEFAULT_OCCLUSION_COLOR;

        if (occ.shape.type === "rect") {
            const screenCoords = this.percentToScreen(occ.shape.x, occ.shape.y);
            const width = (occ.shape.width / 100) * this.canvas.width;
            const height = (occ.shape.height / 100) * this.canvas.height;

            // Fill
            this.ctx.fillStyle = color;
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillRect(screenCoords.x, screenCoords.y, width, height);
            this.ctx.globalAlpha = 1;

            // Border
            this.ctx.strokeStyle = selected ? "#3b82f6" : "#ffffff";
            this.ctx.lineWidth = selected ? 3 : 2;
            this.ctx.strokeRect(screenCoords.x, screenCoords.y, width, height);

            // Selection handles
            if (selected) {
                this.drawSelectionHandles(screenCoords.x, screenCoords.y, width, height);
            }

            // Label
            if (occ.label) {
                this.ctx.fillStyle = "#ffffff";
                this.ctx.font = "bold 16px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(
                    occ.label,
                    screenCoords.x + width / 2,
                    screenCoords.y + height / 2
                );
            }
        }
    }

    private drawSelectionHandles(x: number, y: number, width: number, height: number): void {
        if (!this.ctx) return;

        const handleSize = 8;
        this.ctx.fillStyle = "#3b82f6";

        // Corner handles
        const corners = [
            { x: x - handleSize / 2, y: y - handleSize / 2 },
            { x: x + width - handleSize / 2, y: y - handleSize / 2 },
            { x: x - handleSize / 2, y: y + height - handleSize / 2 },
            { x: x + width - handleSize / 2, y: y + height - handleSize / 2 },
        ];

        for (const corner of corners) {
            this.ctx.fillRect(corner.x, corner.y, handleSize, handleSize);
        }
    }

    private drawPreviewRect(start: Point, end: Point): void {
        if (!this.ctx) return;

        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        // Preview fill
        this.ctx.fillStyle = DEFAULT_OCCLUSION_COLOR;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillRect(x, y, width, height);
        this.ctx.globalAlpha = 1;

        // Preview border
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.setLineDash([]);
    }

    // === Mouse/Touch Event Handlers ===

    private handleMouseDown(e: MouseEvent): void {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool === "rect") {
            this.pushUndoState();
            this.isDrawing = true;
            this.startPoint = { x, y };
            this.currentPoint = { x, y };
        } else if (this.currentTool === "select") {
            const clickedOcc = this.findOcclusionAtPoint(x, y);
            this.selectedOcclusionId = clickedOcc?.id ?? null;
            this.redraw();
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDrawing) {
            this.currentPoint = { x, y };
            this.redraw();
        }

        // Update cursor
        if (this.currentTool === "rect") {
            this.canvas.style.cursor = "crosshair";
        } else if (this.currentTool === "select") {
            const hovered = this.findOcclusionAtPoint(x, y);
            this.canvas.style.cursor = hovered ? "move" : "default";
        }
    }

    private handleMouseUp(e: MouseEvent): void {
        if (!this.canvas) return;

        if (this.isDrawing && this.startPoint && this.currentPoint && this.currentTool === "rect") {
            const rect = this.canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            const startPercent = this.screenToPercent(this.startPoint.x, this.startPoint.y);
            const endPercent = this.screenToPercent(endX, endY);

            const x = Math.min(startPercent.x, endPercent.x);
            const y = Math.min(startPercent.y, endPercent.y);
            const width = Math.abs(endPercent.x - startPercent.x);
            const height = Math.abs(endPercent.y - startPercent.y);

            // Only create if large enough
            if (width >= MIN_SHAPE_SIZE && height >= MIN_SHAPE_SIZE) {
                const shape = createRectShape(x, y, width, height);
                const occ: OcclusionItem = {
                    id: generateOcclusionId(),
                    shape,
                    label: String(this.labelCounter++),
                    color: DEFAULT_OCCLUSION_COLOR,
                };
                this.occlusions.push(occ);
                this.selectedOcclusionId = occ.id;
                this.updateOcclusionsList();
            }
        }

        this.isDrawing = false;
        this.startPoint = null;
        this.currentPoint = null;
        this.redraw();
    }

    // Touch handlers
    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;

        this.handleMouseDown({
            clientX: touch.clientX,
            clientY: touch.clientY,
        } as MouseEvent);
    }

    private handleTouchMove(e: TouchEvent): void {
        e.preventDefault();
        const touch = e.touches[0];
        if (!touch) return;

        this.handleMouseMove({
            clientX: touch.clientX,
            clientY: touch.clientY,
        } as MouseEvent);
    }

    private handleTouchEnd(e: TouchEvent): void {
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (!touch) return;

        this.handleMouseUp({
            clientX: touch.clientX,
            clientY: touch.clientY,
        } as MouseEvent);
    }

    // === Coordinate Conversion ===

    private screenToPercent(screenX: number, screenY: number): Point {
        if (!this.canvas) return { x: 0, y: 0 };
        return {
            x: Math.max(0, Math.min(100, (screenX / this.canvas.width) * 100)),
            y: Math.max(0, Math.min(100, (screenY / this.canvas.height) * 100)),
        };
    }

    private percentToScreen(percentX: number, percentY: number): Point {
        if (!this.canvas) return { x: 0, y: 0 };
        return {
            x: (percentX / 100) * this.canvas.width,
            y: (percentY / 100) * this.canvas.height,
        };
    }

    // === Occlusion Management ===

    private findOcclusionAtPoint(screenX: number, screenY: number): OcclusionItem | null {
        if (!this.canvas) return null;

        const percentPoint = this.screenToPercent(screenX, screenY);

        // Search in reverse order (top-most first)
        for (let i = this.occlusions.length - 1; i >= 0; i--) {
            const occ = this.occlusions[i];
            if (!occ) continue;
            if (occ.shape.type === "rect") {
                const shape = occ.shape;
                if (
                    percentPoint.x >= shape.x &&
                    percentPoint.x <= shape.x + shape.width &&
                    percentPoint.y >= shape.y &&
                    percentPoint.y <= shape.y + shape.height
                ) {
                    return occ;
                }
            }
        }
        return null;
    }

    private deleteSelected(): void {
        if (!this.selectedOcclusionId) return;

        this.pushUndoState();
        this.occlusions = this.occlusions.filter(o => o.id !== this.selectedOcclusionId);
        this.selectedOcclusionId = null;
        this.updateOcclusionsList();
        this.redraw();
    }

    private setTool(tool: EditorTool): void {
        this.currentTool = tool;

        // Update button states
        const buttons = this.contentEl.querySelectorAll(".episteme-io-tool-btn[data-tool]");
        buttons.forEach(btn => {
            const btnTool = btn.getAttribute("data-tool");
            btn.classList.toggle("active", btnTool === tool);
        });

        // Update cursor
        if (this.canvas) {
            this.canvas.style.cursor = tool === "rect" ? "crosshair" : "default";
        }
    }

    // === Undo/Redo ===

    private pushUndoState(): void {
        this.undoStack.push(JSON.parse(JSON.stringify(this.occlusions)));
        this.redoStack = []; // Clear redo stack on new action
        if (this.undoStack.length > 50) {
            this.undoStack.shift(); // Limit stack size
        }
    }

    private undo(): void {
        if (this.undoStack.length === 0) return;

        this.redoStack.push(JSON.parse(JSON.stringify(this.occlusions)));
        this.occlusions = this.undoStack.pop()!;
        this.selectedOcclusionId = null;
        this.updateOcclusionsList();
        this.redraw();
    }

    private redo(): void {
        if (this.redoStack.length === 0) return;

        this.undoStack.push(JSON.parse(JSON.stringify(this.occlusions)));
        this.occlusions = this.redoStack.pop()!;
        this.selectedOcclusionId = null;
        this.updateOcclusionsList();
        this.redraw();
    }

    // === Sidebar ===

    private sidebarListEl: HTMLElement | null = null;

    private renderSidebar(container: HTMLElement): void {
        const sidebar = container.createDiv({ cls: "episteme-io-sidebar" });

        // Occlusions list header
        sidebar.createEl("h3", { text: "Occlusions", cls: "episteme-io-sidebar-title" });

        // Occlusions list
        this.sidebarListEl = sidebar.createDiv({ cls: "episteme-io-occlusion-list" });
        this.updateOcclusionsList();

        // Mode selector
        const modeSection = sidebar.createDiv({ cls: "episteme-io-mode-section" });
        modeSection.createEl("h3", { text: "Mode", cls: "episteme-io-sidebar-title" });

        const modeSelect = modeSection.createEl("select", { cls: "episteme-io-mode-select" });

        const hideOneOption = modeSelect.createEl("option", {
            text: "Hide One (one card per occlusion)",
            attr: { value: "hide-one" },
        });
        if (this.mode === "hide-one") hideOneOption.selected = true;

        const hideAllOption = modeSelect.createEl("option", {
            text: "Hide All (single card)",
            attr: { value: "hide-all" },
        });
        if (this.mode === "hide-all") hideAllOption.selected = true;

        modeSelect.addEventListener("change", () => {
            this.mode = modeSelect.value as OcclusionMode;
        });

        // Instructions
        const instructions = sidebar.createDiv({ cls: "episteme-io-instructions" });
        instructions.createEl("p", { text: "Draw rectangles to create occlusions." });
        instructions.createEl("p", { text: "Keyboard: R=Rectangle, V=Select, Del=Delete" });
    }

    private updateOcclusionsList(): void {
        if (!this.sidebarListEl) return;

        this.sidebarListEl.empty();

        if (this.occlusions.length === 0) {
            this.sidebarListEl.createEl("p", {
                text: "No occlusions yet",
                cls: "episteme-io-empty",
            });
            return;
        }

        for (const occ of this.occlusions) {
            const item = this.sidebarListEl.createDiv({
                cls: `episteme-io-occlusion-item ${occ.id === this.selectedOcclusionId ? "selected" : ""}`,
            });

            // Color indicator
            const colorIndicator = item.createDiv({ cls: "episteme-io-color-indicator" });
            colorIndicator.style.backgroundColor = occ.color || DEFAULT_OCCLUSION_COLOR;

            // Label
            const labelEl = item.createSpan({
                text: occ.label || "Unlabeled",
                cls: "episteme-io-item-label",
            });

            // Delete button
            const deleteBtn = item.createEl("button", {
                text: "x",
                cls: "episteme-io-item-delete",
                attr: { title: "Delete" },
            });
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.pushUndoState();
                this.occlusions = this.occlusions.filter(o => o.id !== occ.id);
                if (this.selectedOcclusionId === occ.id) {
                    this.selectedOcclusionId = null;
                }
                this.updateOcclusionsList();
                this.redraw();
            });

            // Click to select
            item.addEventListener("click", () => {
                this.selectedOcclusionId = occ.id;
                this.updateOcclusionsList();
                this.redraw();
            });
        }
    }

    // === Footer ===

    private renderFooter(container: HTMLElement): void {
        const footer = container.createDiv({ cls: "episteme-modal-buttons" });

        const cancelBtn = footer.createEl("button", {
            text: "Cancel",
            cls: "episteme-btn episteme-btn-secondary",
        });
        cancelBtn.addEventListener("click", () => this.close());

        const saveBtn = footer.createEl("button", {
            text: "Create Cards",
            cls: "episteme-btn episteme-btn-primary",
        });
        saveBtn.addEventListener("click", () => this.handleSubmit());
    }

    // === Keyboard Shortcuts ===

    private setupKeyboardShortcuts(container: HTMLElement): void {
        container.addEventListener("keydown", (e) => {
            // Don't capture if in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
                return;
            }

            // Tool shortcuts
            if (e.key === "r" || e.key === "R") {
                e.preventDefault();
                this.setTool("rect");
            } else if (e.key === "v" || e.key === "V") {
                e.preventDefault();
                this.setTool("select");
            }

            // Delete
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                this.deleteSelected();
            }

            // Undo/Redo
            if ((e.metaKey || e.ctrlKey) && e.key === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "y") {
                e.preventDefault();
                this.redo();
            }

            // Escape to cancel
            if (e.key === "Escape") {
                e.preventDefault();
                this.close();
            }
        });
    }

    // === Submit/Close ===

    private handleSubmit(): void {
        if (this.occlusions.length === 0) {
            // Show error - need at least one occlusion
            return;
        }

        this.hasSubmitted = true;

        const data: ImageOcclusionData = {
            version: 1,
            imagePath: this.options.imagePath,
            originalWidth: this.imageWidth,
            originalHeight: this.imageHeight,
            occlusions: this.occlusions,
            mode: this.mode,
        };

        if (this.resolvePromise) {
            this.resolvePromise({
                cancelled: false,
                data,
            });
            this.resolvePromise = null;
        }
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        if (!this.hasSubmitted && this.resolvePromise) {
            this.resolvePromise({
                cancelled: true,
            });
            this.resolvePromise = null;
        }
    }
}
