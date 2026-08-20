const WIKI_IMAGE_RE = /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/i;
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/i;
const HTML_IMAGE_RE = /<img\b[^>]*\bsrc=["']([^"']+)["']/i;

export function getFirstPanelImageRef(...contents: string[]): string | null {
	for (const content of contents) {
		const wikiRef = WIKI_IMAGE_RE.exec(content)?.[1]?.trim();
		if (wikiRef) return wikiRef;

		const markdownMatch = MARKDOWN_IMAGE_RE.exec(content);
		const markdownRef = (markdownMatch?.[1] ?? markdownMatch?.[2])?.trim();
		if (markdownRef) return markdownRef;

		const htmlRef = HTML_IMAGE_RE.exec(content)?.[1]?.trim();
		if (htmlRef) return htmlRef;
	}
	return null;
}

export function isExternalPanelImageRef(ref: string): boolean {
	return /^(?:https?:|data:|app:|blob:)/i.test(ref);
}
