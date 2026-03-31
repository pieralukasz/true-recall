export interface ImageInsertOptions {
    path: string;
    width?: number;
    alt?: string;
}
export declare const IMAGE_EXTENSIONS: readonly ["png", "jpg", "jpeg", "gif", "webp", "svg"];
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];
export declare function isImageExtension(ext: string): ext is ImageExtension;
export declare const MAX_IMAGE_SIZE_BYTES: number;
export declare const MAX_VIDEO_SIZE_BYTES: number;
export declare const VIDEO_EXTENSIONS: readonly ["mp4", "webm", "mov", "ogg"];
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];
export declare function isVideoExtension(ext: string): ext is VideoExtension;
export declare const MEDIA_EXTENSIONS: readonly ["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mov", "ogg"];
export type MediaExtension = (typeof MEDIA_EXTENSIONS)[number];
export declare function isMediaExtension(ext: string): ext is MediaExtension;
