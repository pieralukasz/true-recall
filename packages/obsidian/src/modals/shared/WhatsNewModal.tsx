import { render } from "preact";

import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { resolveAccessTier } from "@true-recall/obsidian/plugin/plugin-utils";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import type { ReleaseInfo } from "@true-recall/obsidian/services/release-notes.service";

import type TrueRecallPlugin from "../../main";
import { WhatsNewBody } from "./whats-new/WhatsNewBody";

export class WhatsNewModal extends BaseModal {
	constructor(
		private readonly plugin: TrueRecallPlugin,
		private readonly releases: ReleaseInfo[],
		private readonly expandedVersions: readonly string[] = [
			releases[0]?.version ?? "",
		],
	) {
		super(plugin.app, {
			title: "What's new",
			width: "660px",
			modifierClass: "tr-modal-whats-new",
			fillHeight: true,
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.plugin.app, plugin: this.plugin }}>
				<WhatsNewBody
					releases={this.releases}
					expandedVersions={this.expandedVersions}
					installedVersion={this.plugin.manifest.version}
					tier={resolveAccessTier(this.plugin.settings)}
					onClose={() => this.close()}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
