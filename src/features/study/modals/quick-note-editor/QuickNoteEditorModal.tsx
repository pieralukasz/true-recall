import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { render } from "preact";
import type TrueRecallPlugin from "../../../../main";
import { QuickNoteEditorApp } from "./QuickNoteEditorApp";
import type { QuickNoteEditorMode, QuickNoteEditorResult } from "./types";

export class QuickNoteEditorModal extends BasePromiseModal<QuickNoteEditorResult> {
	constructor(
		app: App,
		private plugin: TrueRecallPlugin,
		private editorMode: QuickNoteEditorMode,
	) {
		super(app, {
			title: editorMode.mode === "add" ? "Add Flashcard" : "Edit Flashcard",
			width: "660px",
		});
	}

	protected getDefaultResult(): QuickNoteEditorResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<QuickNoteEditorApp
					mode={this.editorMode}
					onDone={(result) => this.resolve(result)}
				/>
			</ObsidianProvider>,
			container,
		);
	}
}
