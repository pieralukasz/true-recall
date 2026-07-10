export function resolveAttachmentFolder(
	attachmentFolderOverride: string,
	fallbackFolder: string,
): string {
	return attachmentFolderOverride.trim() || fallbackFolder;
}
