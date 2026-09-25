import { useState } from "preact/hooks";

import { MarkdownContent } from "@true-recall/obsidian/components";
import type { ReleaseInfo } from "@true-recall/obsidian/services/release-notes.service";

export function ReleaseSection({
	release,
	initiallyExpanded,
	installedVersion,
}: {
	release: ReleaseInfo;
	initiallyExpanded: boolean;
	installedVersion: string;
}) {
	const [expanded, setExpanded] = useState(initiallyExpanded);
	const date = new Date(`${release.publishedAt}T12:00:00`).toLocaleDateString(
		undefined,
		{ year: "numeric", month: "short", day: "numeric" },
	);

	return (
		<details
			open={expanded}
			onToggle={(event) => setExpanded(event.currentTarget.open)}
			class="tr-release"
		>
			<summary class="tr-release-heading">
				<span class="tr-release-chevron" aria-hidden="true" />
				<span class="tr-release-version">{release.name}</span>
				{release.version === installedVersion ? (
					<span class="tr-release-badge">Installed</span>
				) : null}
				<time class="tr-release-date" dateTime={release.publishedAt}>
					{date}
				</time>
			</summary>
			{expanded ? (
				<MarkdownContent markdown={release.body} class="tr-release-content" />
			) : null}
		</details>
	);
}
