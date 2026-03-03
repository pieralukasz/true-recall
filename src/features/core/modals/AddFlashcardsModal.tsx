import { BaseModal } from "@shared/ui/modals/BaseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { render } from "preact";
import type TrueRecallPlugin from "../../../main";
import { AddFlashcardsApp } from "./add-flashcards/AddFlashcardsApp";

interface AddFlashcardsModalOptions {
	defaultNoteTypeId?: string;
}

export class AddFlashcardsModal extends BaseModal {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private options?: AddFlashcardsModalOptions,
	) {
		super(app, {
			title: "Add Flashcards",
			width: "720px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<AddFlashcardsApp
					onClose={() => this.close()}
					defaultNoteTypeId={this.options?.defaultNoteTypeId}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
