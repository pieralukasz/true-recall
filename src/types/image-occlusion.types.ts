/**
 * Image Occlusion Types for Episteme
 * Defines types for hiding/revealing parts of images during flashcard review
 */

/**
 * Rectangle shape - primary shape for MVP
 * All coordinates are percentages (0-100) for responsive scaling
 */
export interface RectShape {
    type: "rect";
    /** X position as percentage from left (0-100) */
    x: number;
    /** Y position as percentage from top (0-100) */
    y: number;
    /** Width as percentage of image width (0-100) */
    width: number;
    /** Height as percentage of image height (0-100) */
    height: number;
}

/**
 * Ellipse shape (future enhancement)
 */
export interface EllipseShape {
    type: "ellipse";
    /** Center X as percentage (0-100) */
    cx: number;
    /** Center Y as percentage (0-100) */
    cy: number;
    /** X radius as percentage (0-100) */
    rx: number;
    /** Y radius as percentage (0-100) */
    ry: number;
}

/**
 * Polygon shape (future enhancement)
 */
export interface PolygonShape {
    type: "polygon";
    /** Array of points, each as percentage coordinates */
    points: Array<{ x: number; y: number }>;
}

/**
 * Union of all supported occlusion shapes
 * MVP: Only RectShape is implemented
 */
export type OcclusionShape = RectShape | EllipseShape | PolygonShape;

/**
 * Single occlusion item representing one masked region
 */
export interface OcclusionItem {
    /** Unique ID for this occlusion (UUID) */
    id: string;
    /** Shape definition */
    shape: OcclusionShape;
    /** Optional label displayed on the occlusion (e.g., "A", "1", "?") */
    label?: string;
    /** Optional hint shown when hovering */
    hint?: string;
    /** Custom occlusion color (default: #ff6b6b) */
    color?: string;
}

/**
 * Occlusion mode determines review behavior
 * - hide-one: Creates one card per occlusion, reveals that one on answer (best for learning)
 * - hide-all: Single card that hides all regions, reveals all on answer
 */
export type OcclusionMode = "hide-one" | "hide-all";

/**
 * Complete image occlusion data stored in the card's question field
 */
export interface ImageOcclusionData {
    /** Schema version for future migrations */
    version: 1;
    /** Path to image file (vault-relative) */
    imagePath: string;
    /** Original image width in pixels (for aspect ratio) */
    originalWidth: number;
    /** Original image height in pixels (for aspect ratio) */
    originalHeight: number;
    /** All occlusion shapes */
    occlusions: OcclusionItem[];
    /** Review mode */
    mode: OcclusionMode;
    /** Optional question text displayed above the image */
    questionText?: string;
    /** Optional notes/answer text displayed when revealed */
    notes?: string;
    /** For hide-one mode: ID of the target occlusion for this specific card */
    targetOcclusionId?: string;
}

/**
 * Wrapper stored in FSRSCardData.question field
 * Allows detection of IO cards via type field
 */
export interface ImageOcclusionCardData {
    type: "image-occlusion";
    data: ImageOcclusionData;
}

/**
 * Result from the Image Occlusion Editor Modal
 */
export interface ImageOcclusionEditorResult {
    /** Whether the user cancelled */
    cancelled: boolean;
    /** The occlusion data if not cancelled */
    data?: ImageOcclusionData;
}

// ============ Helper Functions ============

/**
 * Check if a card's question contains image occlusion data
 */
export function isImageOcclusionCard(question: string | undefined): boolean {
    if (!question) return false;
    try {
        const parsed = JSON.parse(question);
        return parsed?.type === "image-occlusion";
    } catch {
        return false;
    }
}

/**
 * Parse image occlusion data from a card's question field
 * Returns null if not an IO card or if parsing fails
 */
export function parseImageOcclusionData(question: string | undefined): ImageOcclusionData | null {
    if (!question) return null;
    try {
        const parsed = JSON.parse(question) as ImageOcclusionCardData;
        if (parsed?.type === "image-occlusion" && parsed.data) {
            return parsed.data;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Serialize image occlusion data for storage in question field
 */
export function serializeImageOcclusionData(data: ImageOcclusionData): string {
    const cardData: ImageOcclusionCardData = {
        type: "image-occlusion",
        data,
    };
    return JSON.stringify(cardData);
}

/**
 * Create a default RectShape at given percentage coordinates
 */
export function createRectShape(
    x: number,
    y: number,
    width: number,
    height: number
): RectShape {
    return {
        type: "rect",
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        width: Math.max(0, Math.min(100 - x, width)),
        height: Math.max(0, Math.min(100 - y, height)),
    };
}

/**
 * Generate a unique ID for an occlusion
 */
export function generateOcclusionId(): string {
    return crypto.randomUUID();
}

/**
 * Default occlusion color
 */
export const DEFAULT_OCCLUSION_COLOR = "#ff6b6b";

/**
 * Minimum shape size in percentage (to avoid accidental tiny shapes)
 */
export const MIN_SHAPE_SIZE = 1;
