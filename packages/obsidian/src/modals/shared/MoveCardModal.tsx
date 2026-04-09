import type { App, TFile } from "obsidian";
import { render } from "preact";

import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { MoveCardBody } from "@true-recall/obsidian/modals/shared/move-card/MoveCardBody";

export interface MoveCardResult {
	cancelled: boolean;
	targetNotePath: string | null;
}

export interface MoveCardModalOptions {
	cardCount: number;
	sourceNoteName?: string;
	cardQuestion?: string;
	cardAnswer?: string;
}

export class MoveCardModal extends BasePromiseModal<MoveCardResult> {
	private options: MoveCardModalOptions;
	private allNotes: TFile[] = [];

	constructor(app: App, options: MoveCardModalOptions) {
		super(app, {
			title:
				options.cardCount === 1
					? "Move flashcard to..."
					: `Move ${options.cardCount} flashcards to...`,
			width: "500px",
		});
		this.options = options;
	}

	protected getDefaultResult(): MoveCardResult {
		return { cancelled: true, targetNotePath: null };
	}

	onOpen(): void {
		this.allNotes = this.getValidNotes();
		super.onOpen();
		this.contentEl.addClass("true-recall-move-card-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<MoveCardBody
				allNotes={this.allNotes}
				app={this.app}
				cardQuestion={this.options.cardQuestion}
				cardAnswer={this.options.cardAnswer}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}

	private getValidNotes(): TFile[] {
		return this.app.vault.getMarkdownFiles().filter((file) => {
			if (
				this.options.sourceNoteName &&
				file.basename === this.options.sourceNoteName
			) {
				return false;
			}
			return true;
		});
	}
}
