import type { App, TFile } from "obsidian";

export function noteHasTagPrefix(
	app: App,
	file: TFile,
	tagPrefix: string,
): boolean {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return false;

	const prefixLower = tagPrefix.toLowerCase();

	const frontmatterTags = (cache.frontmatter?.tags ?? []) as string | string[];
	const normalizedTags = Array.isArray(frontmatterTags)
		? frontmatterTags
		: [frontmatterTags];

	for (const tag of normalizedTags) {
		if (typeof tag !== "string") continue;
		const normalizedTag = (
			tag.startsWith("#") ? tag.slice(1) : tag
		).toLowerCase();
		if (normalizedTag.startsWith(prefixLower)) {
			return true;
		}
	}

	const inlineTags = cache.tags ?? [];
	return inlineTags.some((t) => {
		const tagWithoutHash = t.tag.slice(1).toLowerCase();
		return tagWithoutHash.startsWith(prefixLower);
	});
}

export function extractBacklinks(
	cardQuestion?: string,
	cardAnswer?: string,
): string[] {
	const content = `${cardQuestion ?? ""} ${cardAnswer ?? ""}`;
	const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
	const links: string[] = [];
	let match: RegExpExecArray | null = linkRegex.exec(content);
	while (match !== null) {
		if (match[1]) links.push(match[1]);
		match = linkRegex.exec(content);
	}
	return [...new Set(links)];
}
