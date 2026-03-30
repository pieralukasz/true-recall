import type { ReleaseInfo } from "@shared/services/release-notes.service";
import { Clickable, MarkdownContent } from "@shared/ui/components";
import { BaseModal } from "@shared/ui/modals/BaseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import { render } from "preact";
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
			<div class="ep:flex ep:justify-between ep:mt-4 ep:pt-3 ep:border-t ep:border-obs-border">
				<Clickable
					stopPropagation={false}
					class="ep-btn ep-btn-outline"
					onClick={() => window.open(release.htmlUrl)}
				>
					View on GitHub
				</Clickable>
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
