import { BaseModal } from "@shared/ui/modals/BaseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { render } from "preact";
import type TrueRecallPlugin from "../../main";
import { NoteTypeManagerApp } from "./note-type-manager/NoteTypeManagerApp";

export class NoteTypeManagerModal extends BaseModal {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
	) {
		super(app, {
			title: "Manage Note Types",
			width: "860px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<NoteTypeManagerApp onClose={() => this.close()} />
			</ObsidianProvider>,
			container,
		);
	}
}
