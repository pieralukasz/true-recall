import { TRUERECALL_GITHUB_URL } from "@true-recall/core/constants";

import changelog from "../../../../CHANGELOG.md?raw";

export interface ReleaseInfo {
	version: string;
	name: string;
	body: string;
	publishedAt: string;
	htmlUrl: string;
}

/** The left-hand version is always a stable release from the changelog. */
function compareReleaseVersion(
	release: string,
	version: string,
): number | null {
	const pattern = /^v?(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(?:\+[\w.-]+)?$/;
	const left = release.match(pattern);
	const right = version.match(pattern);
	if (!left || !right) return null;
	for (let part = 1; part <= 3; part++) {
		const difference = Number(left[part]) - Number(right[part]);
		if (difference !== 0) return difference;
	}
	return right[4] ? 1 : 0;
}

export function parseReleaseNotes(markdown: string): ReleaseInfo[] {
	const releases: ReleaseInfo[] = [];
	for (const section of markdown.split(/^## /m)) {
		const match = section.match(
			/^(\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)\r?\n([\s\S]*)$/,
		);
		if (!match) continue;
		const [, version, date, body] = match;
		if (!version || !date || !body?.trim()) continue;
		releases.push({
			version,
			name: `v${version}`,
			body: body.trim(),
			publishedAt: date,
			htmlUrl: `${TRUERECALL_GITHUB_URL}/releases/tag/${version}`,
		});
	}
	return releases.sort(
		(a, b) => compareReleaseVersion(b.version, a.version) ?? 0,
	);
}

const releases = parseReleaseNotes(changelog);

export function getReleaseNotes(
	currentVersion: string,
	sinceVersion?: string,
): ReleaseInfo[] {
	return releases.filter((release) => {
		const current = compareReleaseVersion(release.version, currentVersion);
		if (current === null || current > 0) return false;
		if (sinceVersion === undefined) return true;
		const previous = compareReleaseVersion(release.version, sinceVersion);
		return previous !== null && previous > 0;
	});
}
