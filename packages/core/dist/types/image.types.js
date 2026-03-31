export const IMAGE_EXTENSIONS = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
];
export function isImageExtension(ext) {
    return IMAGE_EXTENSIONS.includes(ext.toLowerCase());
}
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "ogg"];
export function isVideoExtension(ext) {
    return VIDEO_EXTENSIONS.includes(ext.toLowerCase());
}
export const MEDIA_EXTENSIONS = [
    ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS,
];
export function isMediaExtension(ext) {
    return isImageExtension(ext) || isVideoExtension(ext);
}
