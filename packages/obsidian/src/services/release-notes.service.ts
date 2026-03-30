import { GITHUB_RELEASES_API } from "@true-recall/core/constants";
import { requestUrl } from "obsidian";

export interface ReleaseInfo {
	version: string;
	name: string;
	body: string;
	publishedAt: string;
	htmlUrl: string;
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
	try {
		const response = await requestUrl({
			url: GITHUB_RELEASES_API,
			method: "GET",
			headers: { Accept: "application/vnd.github.v3+json" },
		});
		if (response.status !== 200) return null;

		const data = response.json;
		return {
			version: (data.tag_name as string).replace(/^v/, ""),
			name: data.name ?? data.tag_name,
			body: data.body ?? "",
			publishedAt: data.published_at,
			htmlUrl: data.html_url,
		};
	} catch {
		return null;
	}
}
