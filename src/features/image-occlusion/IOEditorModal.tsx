import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { render } from "preact";
import type TrueRecallPlugin from "../../main";
import { IOEditorApp } from "./IOEditorApp";
import type { IOEditorMode, IOEditorResult } from "./types";

export class IOEditorModal extends BasePromiseModal<IOEditorResult> {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private mode: IOEditorMode,
	) {
		super(app, {
			title:
				mode.mode === "edit"
					? "Edit image occlusion"
					: "Create image occlusion",
			width: "900px",
		});
	}

	protected getDefaultResult(): IOEditorResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<IOEditorApp mode={this.mode} onDone={(result) => this.resolve(result)} />
			</ObsidianProvider>,
			container,
		);
	}
}

