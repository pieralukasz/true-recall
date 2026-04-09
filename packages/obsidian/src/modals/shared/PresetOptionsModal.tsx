import type { App } from "obsidian";
import { render } from "preact";

import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import {
	PresetOptionsBody,
	type PresetOptionsContext,
} from "@true-recall/obsidian/modals/shared/preset-options/PresetOptionsBody";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import type TrueRecallPlugin from "../../main";

export interface PresetOptionsModalOptions {
	initialPresetId?: string;
	contextPath?: string;
	contextName?: string;
}

export class PresetOptionsModal extends BaseModal {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private options: PresetOptionsModalOptions = {},
	) {
		super(app, {
			title: "Preset Options",
			width: "560px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		const context: PresetOptionsContext | undefined = this.options.contextPath
			? {
					contextPath: this.options.contextPath,
					contextName: this.options.contextName,
				}
			: undefined;

		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<PresetOptionsBody
					initialPresetId={this.options.initialPresetId}
					context={context}
					onClose={() => this.close()}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
