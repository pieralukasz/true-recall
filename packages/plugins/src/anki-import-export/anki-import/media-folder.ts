import { resolveAttachmentFolder } from "@true-recall/obsidian/utils/attachment-folder";

/**
 * Folder where Anki import media lands. Shared by the actual import and the
 * preview checkbox so the displayed path matches what the import does.
 */
export function resolveAnkiMediaFolder(
	attachmentFolderOverride: string,
	importFolder: string,
	deckNames: string[],
): string {
	const topDeck = ((deckNames[0] ?? "import").split("/").at(0) ?? "import")
		.replace(/[\\/:*?"<>|]/g, "-")
		.trim();
	return resolveAttachmentFolder(
		attachmentFolderOverride,
		`Attachments/${importFolder}/${topDeck}`,
	);
}
