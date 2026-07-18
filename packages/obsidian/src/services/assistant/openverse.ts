import type { ImageCandidate } from "@true-recall/core/ai/assistant";

export const OPENVERSE_URL = "https://api.openverse.org/v1/images/";

/**
 * Maps a raw Openverse `/v1/images` response to image candidates.
 * Defensive: drops results without a usable url, caps at `count`.
 */
export function mapOpenverseResults(
	json: unknown,
	count: number,
): ImageCandidate[] {
	const results = (json as { results?: unknown[] })?.results ?? [];
	const out: ImageCandidate[] = [];
	for (const raw of results) {
		if (out.length >= count) break;
		const r = raw as {
			url?: unknown;
			thumbnail?: unknown;
			title?: unknown;
			license?: unknown;
		};
		if (typeof r.url !== "string" || r.url === "") continue;
		const candidate: ImageCandidate = { url: r.url };
		if (typeof r.thumbnail === "string") candidate.thumbnailUrl = r.thumbnail;
		if (typeof r.title === "string") candidate.title = r.title;
		if (typeof r.license === "string") candidate.license = r.license;
		out.push(candidate);
	}
	return out;
}
