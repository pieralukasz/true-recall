export interface ImageInsertOptions {
	path: string;
	width?: number;
	alt?: string;
}

export const IMAGE_EXTENSIONS = [
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"svg",
] as const;
export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

export function isImageExtension(ext: string): ext is ImageExtension {
	return IMAGE_EXTENSIONS.includes(ext.toLowerCase() as ImageExtension);
}

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "ogg"] as const;
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];

export function isVideoExtension(ext: string): ext is VideoExtension {
	return VIDEO_EXTENSIONS.includes(ext.toLowerCase() as VideoExtension);
}

export const MEDIA_EXTENSIONS = [
	...IMAGE_EXTENSIONS,
	...VIDEO_EXTENSIONS,
] as const;
export type MediaExtension = (typeof MEDIA_EXTENSIONS)[number];

export function isMediaExtension(ext: string): ext is MediaExtension {
	return isImageExtension(ext) || isVideoExtension(ext);
}
