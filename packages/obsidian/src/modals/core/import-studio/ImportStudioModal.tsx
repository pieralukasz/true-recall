import type { App } from "obsidian";
import { render } from "preact";

import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import type TrueRecallPlugin from "../../../main";
import { ImportStudioApp } from "./ImportStudioApp";

interface ImportStudioModalOptions {
	defaultNoteTypeId?: string;
}

export class ImportStudioModal extends BaseModal {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private options?: ImportStudioModalOptions,
	) {
		super(app, {
			title: "Import Flashcards",
			width: "720px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<ImportStudioApp
					onClose={() => this.close()}
					defaultNoteTypeId={this.options?.defaultNoteTypeId}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
