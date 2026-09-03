import { render } from "preact";

import { TRUERECALL_NEWSLETTER_URL } from "@true-recall/core/constants";

import { Clickable, MarkdownContent } from "@true-recall/obsidian/components";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import type { ReleaseInfo } from "@true-recall/obsidian/services/release-notes.service";

import type TrueRecallPlugin from "../../main";

function WhatsNewBody({
	release,
	onClose,
}: {
	release: ReleaseInfo;
	onClose: () => void;
}) {
	const date = new Date(release.publishedAt).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<>
			<div class="ep:text-ui-small ep:text-obs-muted ep:mb-3">
				{release.name} &mdash; {date}
			</div>
			<div class="ep:max-h-[60vh] ep:overflow-y-auto ep:pr-2">
				<MarkdownContent markdown={release.body} />
			</div>
			{/* Wraps on narrow screens: three buttons do not fit one row on a phone. */}
			<div class="ep:flex ep:flex-wrap ep:gap-2 ep:justify-between ep:mt-4 ep:pt-3 ep:border-t ep:border-obs-border">
				<div class="ep:flex ep:flex-wrap ep:gap-2">
					<Clickable
						stopPropagation={false}
						class="ep-btn ep-btn-outline"
						onClick={() => window.open(release.htmlUrl)}
					>
						View on GitHub
					</Clickable>
					<Clickable
						stopPropagation={false}
						class="ep-btn ep-btn-outline"
						onClick={() => window.open(TRUERECALL_NEWSLETTER_URL, "_blank")}
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
		private readonly release: ReleaseInfo,
	) {
		super(plugin.app, {
			title: `What's New in v${release.version}`,
			width: "550px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.plugin.app, plugin: this.plugin }}>
				<WhatsNewBody release={this.release} onClose={() => this.close()} />
			</ObsidianProvider>,
			container,
		);
	}
}
