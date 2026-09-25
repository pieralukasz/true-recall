import {
	TRUERECALL_GITHUB_URL,
	TRUERECALL_NEWSLETTER_URL,
	TRUERECALL_PRO_GUIDE_URL,
} from "@true-recall/core/constants";
import type { PluginTier } from "@true-recall/core/types";
import { withPluginUtm } from "@true-recall/core/utils";

import { ACCESS_TIER_LABEL } from "@true-recall/obsidian/plugin/plugin-utils";
import type { ReleaseInfo } from "@true-recall/obsidian/services/release-notes.service";

import { ReleaseSection } from "./ReleaseSection";

export function WhatsNewBody({
	releases,
	expandedVersions,
	installedVersion,
	tier,
	onClose,
}: {
	releases: ReleaseInfo[];
	expandedVersions: readonly string[];
	installedVersion: string;
	tier: PluginTier;
	onClose: () => void;
}) {
	return (
		<div class="tr-whats-new">
			<div class="tr-whats-new-intro">
				<p>Updates and improvements to True Recall.</p>
				<div class="tr-whats-new-plan">
					<span>{ACCESS_TIER_LABEL[tier]}</span>
					{tier !== "pro" ? (
						<a
							href={withPluginUtm(TRUERECALL_PRO_GUIDE_URL, "whats-new")}
							target="_blank"
							rel="noreferrer"
						>
							Explore Pro
						</a>
					) : null}
				</div>
			</div>
			<div
				class="tr-whats-new-history"
				role="region"
				aria-label="Release history"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll region needs keyboard focus for arrow and page scrolling.
				tabIndex={0}
			>
				{releases.map((release) => (
					<ReleaseSection
						key={release.version}
						release={release}
						installedVersion={installedVersion}
						initiallyExpanded={expandedVersions.includes(release.version)}
					/>
				))}
			</div>
			<footer class="tr-whats-new-footer">
				<nav aria-label="True Recall links">
					<a
						href={`${TRUERECALL_GITHUB_URL}/releases`}
						target="_blank"
						rel="noreferrer"
					>
						GitHub releases
					</a>
					<a
						href={withPluginUtm(TRUERECALL_NEWSLETTER_URL, "whats-new")}
						target="_blank"
						rel="noreferrer"
					>
						Newsletter
					</a>
				</nav>
				<button type="button" class="mod-cta" onClick={onClose}>
					Close
				</button>
			</footer>
		</div>
	);
}
