const IMAGE_EXT = "png|jpe?g|gif|webp|svg|avif|bmp|ico";

const WIKILINK_URL_RE = /\[\[(https?:\/\/[^\]]+)\]\]/g;

const WIKILINK_LOCAL_IMAGE_RE = new RegExp(
	`(?<!!)\\[\\[([^\\]]+\\.(?:${IMAGE_EXT}))(\\|[^\\]]*)?\\]\\]`,
	"gi",
);

const BARE_URL_RE = /(?<![([!])https?:\/\/[^\s)\]]+/g;

const IMAGE_URL_RE = new RegExp(`\\.(?:${IMAGE_EXT})(?:\\?|#|$)`, "i");

const TRAILING_PUNCT_RE = /[.,;:!?]+$/;

export function normalizeSelectionForFlashcard(text: string): string {
	const unwrapped = text.replace(WIKILINK_URL_RE, "$1");

	const localImagesEmbedded = unwrapped.replace(
		WIKILINK_LOCAL_IMAGE_RE,
		(_match, file: string, alias: string | undefined) =>
			`![[${file}${alias ?? ""}]]`,
	);

	return localImagesEmbedded.replace(BARE_URL_RE, (raw) => {
		const trailing = raw.match(TRAILING_PUNCT_RE)?.[0] ?? "";
		const url = trailing ? raw.slice(0, -trailing.length) : raw;
		const markdown = IMAGE_URL_RE.test(url)
			? `![](${url})`
			: `[${url}](${url})`;
		return `${markdown}${trailing}`;
	});
}
