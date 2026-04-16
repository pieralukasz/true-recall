import type { App } from "obsidian";
import { render } from "preact";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import type { IOEditorMode, IOEditorResult } from "../types";
import { IOEditorApp } from "./IOEditorApp";

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
			width: "1120px",
		});
	}

	protected getDefaultResult(): IOEditorResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<IOEditorApp
					mode={this.mode}
					onDone={(result) => this.resolve(result)}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
