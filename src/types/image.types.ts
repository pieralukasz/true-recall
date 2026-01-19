/**
 * Image Types
 * Types for image handling in flashcards
 */

/**
 * Represents a reference from a card to an image file
 */
export interface CardImageRef {
    id?: number;
    cardId: string;
    imagePath: string;
    field: "question" | "answer";
    createdAt?: number;
}

/**
 * Options for inserting an image into a flashcard
 */
export interface ImageInsertOptions {
    /** Path to the image in the vault */
    path: string;
    /** Width in pixels (optional) */
    width?: number;
    /** Alt text (optional) */
    alt?: string;
}

/**
 * Supported image extensions
 */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"] as const;
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/**
 * Check if a file extension is a supported image type
 */
export function isImageExtension(ext: string): ext is ImageExtension {
    return IMAGE_EXTENSIONS.includes(ext.toLowerCase() as ImageExtension);
}

/**
 * Maximum recommended image size in bytes (5MB)
 */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Maximum recommended video size in bytes (50MB)
 */
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Supported video extensions
 */
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "ogg"] as const;
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];

/**
 * Check if a file extension is a supported video type
 */
export function isVideoExtension(ext: string): ext is VideoExtension {
    return VIDEO_EXTENSIONS.includes(ext.toLowerCase() as VideoExtension);
}

/**
 * All supported media extensions (images + videos)
 */
export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] as const;
export type MediaExtension = (typeof MEDIA_EXTENSIONS)[number];

/**
 * Check if a file extension is a supported media type (image or video)
 */
export function isMediaExtension(ext: string): ext is MediaExtension {
    return isImageExtension(ext) || isVideoExtension(ext);
}
