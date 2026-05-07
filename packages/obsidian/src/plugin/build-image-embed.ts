const URL_RE = /^https?:\/\//i;

/**
 * Build the correct markdown for an image path based on whether it points to
 * an external URL or a vault attachment.
 *
 * External URLs use standard markdown `![](url)`. Wrapping a URL in `![[ ]]`
 * would make Obsidian look for a vault file with `://` in its path and render
 * a "could not be found" placeholder. Vault attachments use the embed
 * wikilink `![[path]]`.
 */
export function buildImageEmbed(imagePath: string): string {
	const trimmed = imagePath.trim();
	if (URL_RE.test(trimmed)) return `![](${trimmed})`;
	return `![[${trimmed}]]`;
}
