import { render } from "preact";
import { useState } from "preact/hooks";

import {
	TRUERECALL_GITHUB_URL,
	TRUERECALL_NEWSLETTER_URL,
	TRUERECALL_PRO_GUIDE_URL,
} from "@true-recall/core/constants";
import type { PluginTier } from "@true-recall/core/types";
import { withPluginUtm } from "@true-recall/core/utils";

import { Clickable, MarkdownContent } from "@true-recall/obsidian/components";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import {
	ACCESS_TIER_LABEL,
	resolveAccessTier,
} from "@true-recall/obsidian/plugin/plugin-utils";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import type { ReleaseInfo } from "@true-recall/obsidian/services/release-notes.service";

import type TrueRecallPlugin from "../../main";

function PlanLine({ tier }: { tier: PluginTier }) {
	return (
		<div class="ep:text-ui-small ep:text-obs-muted ep:mb-3">
			You are on <strong>{ACCESS_TIER_LABEL[tier]}</strong>
			{tier !== "pro" ? (
				<>
					{" · "}
					<a
						href={withPluginUtm(TRUERECALL_PRO_GUIDE_URL, "whats-new")}
						class="ep:text-obs-accent"
						target="_blank"
						rel="noreferrer"
					>
						See what Pro adds
					</a>
				</>
			) : null}
		</div>
	);
}

function ReleaseSection({
	release,
	initiallyExpanded,
}: {
	release: ReleaseInfo;
	initiallyExpanded: boolean;
}) {
	const [expanded, setExpanded] = useState(initiallyExpanded);
	const date = new Date(`${release.publishedAt}T12:00:00`).toLocaleDateString(
		undefined,
		{
			year: "numeric",
			month: "long",
			day: "numeric",
		},
	);
	return (
		<details
			open={expanded}
			onToggle={(event) => setExpanded(event.currentTarget.open)}
			class="ep:mb-4 ep:border-b ep:border-obs-border ep:pb-3"
		>
			<summary class="ep:cursor-pointer ep:text-ui-small ep:py-2">
				<strong>{release.name}</strong> &mdash; {date}
			</summary>
			{expanded ? <MarkdownContent markdown={release.body} /> : null}
		</details>
	);
}

function WhatsNewBody({
	releases,
	expandedVersions,
	tier,
	onClose,
}: {
	releases: ReleaseInfo[];
	expandedVersions: readonly string[];
	tier: PluginTier;
	onClose: () => void;
}) {
	return (
		<>
			<PlanLine tier={tier} />
			<div class="ep:max-h-[60vh] ep:overflow-y-auto ep:pr-2">
				{releases.map((release) => (
					<ReleaseSection
						key={release.version}
						release={release}
						initiallyExpanded={expandedVersions.includes(release.version)}
					/>
				))}
			</div>
			{/* Wraps on narrow screens: three buttons do not fit one row on a phone. */}
			<div class="ep:flex ep:flex-wrap ep:gap-2 ep:justify-between ep:mt-4 ep:pt-3 ep:border-t ep:border-obs-border">
				<div class="ep:flex ep:flex-wrap ep:gap-2">
					<Clickable
						stopPropagation={false}
						class="ep-btn ep-btn-outline"
						onClick={() => window.open(`${TRUERECALL_GITHUB_URL}/releases`)}
					>
						View on GitHub
					</Clickable>
					<Clickable
						stopPropagation={false}
						class="ep-btn ep-btn-outline"
						onClick={() =>
							window.open(
								withPluginUtm(TRUERECALL_NEWSLETTER_URL, "whats-new"),
								"_blank",
							)
						}
					>
						Subscribe to the newsletter
					</Clickable>
				</div>
				<Clickable
					stopPropagation={false}
					class="mod-cta ep-btn"
					onClick={onClose}
				>
					Close
				</Clickable>
			</div>
		</>
	);
}

export class WhatsNewModal extends BaseModal {
	constructor(
		private readonly plugin: TrueRecallPlugin,
		private readonly releases: ReleaseInfo[],
		private readonly expandedVersions: readonly string[] = [
			releases[0]?.version ?? "",
		],
	) {
		super(plugin.app, {
			title: `What's New in v${plugin.manifest.version}`,
			width: "550px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.plugin.app, plugin: this.plugin }}>
				<WhatsNewBody
					releases={this.releases}
					expandedVersions={this.expandedVersions}
					tier={resolveAccessTier(this.plugin.settings)}
					onClose={() => this.close()}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
