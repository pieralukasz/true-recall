import { BaseModal } from "@shared/ui/modals/BaseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { render } from "preact";
import type TrueRecallPlugin from "../../../../main";
import { CardTypesEditorApp } from "./CardTypesEditorApp";

export class CardTypesEditorModal extends BaseModal {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private noteTypeId: string,
	) {
		const noteType = plugin.noteTypeService.getById(noteTypeId);
		super(app, {
			title: `Card Types for "${noteType?.name ?? "Unknown"}"`,
			width: "1100px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<CardTypesEditorApp
					noteTypeId={this.noteTypeId}
					onClose={() => this.close()}
					onTitleChange={(title) => this.updateTitle(title)}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
