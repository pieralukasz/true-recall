import { ErrorBoundary } from "@shared/ui/components/ErrorBoundary";
import { confirm } from "@shared/ui/modals/ConfirmModal";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import type { App } from "obsidian";
import { render } from "preact";
import type TrueRecallPlugin from "../../../../main";
import { QuickNoteEditorApp } from "./QuickNoteEditorApp";
import type { QuickNoteEditorMode, QuickNoteEditorResult } from "./types";

export class QuickNoteEditorModal extends BasePromiseModal<QuickNoteEditorResult> {
	private _hasContent = false;
	private _closeConfirmed = false;

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

	close(): void {
		if (this._hasContent && !this._closeConfirmed && !this.hasResolved) {
			void confirm(this.app, {
				title: "Discard changes?",
				message: "You have unsaved content that will be lost.",
				confirmLabel: "Discard",
			}).then((confirmed) => {
				if (confirmed) {
					this._closeConfirmed = true;
					this.close();
				}
			});
			return;
		}
		super.close();
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
				<ErrorBoundary>
					<QuickNoteEditorApp
						mode={this.editorMode}
						onDone={(result) => this.resolve(result)}
						onContentChange={(has) => {
							this._hasContent = has;
						}}
					/>
				</ErrorBoundary>
			</ObsidianProvider>,
			container,
		);
	}
}
