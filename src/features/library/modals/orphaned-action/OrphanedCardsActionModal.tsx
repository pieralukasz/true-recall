import { type App, normalizePath, type TFile } from "obsidian";
import { render } from "preact";
import { BasePromiseModal } from "../../../../shared/ui/modals/BasePromiseModal";
import type {
	OrphanedCardsActionModalOptions,
	OrphanedCardsActionResult,
} from "./types";
import { OrphanedCardsBody } from "./OrphanedCardsBody";

export class OrphanedCardsActionModal extends BasePromiseModal<OrphanedCardsActionResult> {
	private options: OrphanedCardsActionModalOptions;
	private allNotes: TFile[] = [];
	private unmountBody?: () => void;

	constructor(app: App, options: OrphanedCardsActionModalOptions) {
		super(app, {
			title: `Note deleted - ${options.cards.length} flashcard${options.cards.length === 1 ? "" : "s"}`,
			width: "550px",
		});
		this.options = options;
	}

	protected getDefaultResult(): OrphanedCardsActionResult {
		return { cancelled: false, action: "leave_orphaned" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-orphaned-cards-modal");
		this.allNotes = this.app.vault.getMarkdownFiles();
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<OrphanedCardsBody
				cards={this.options.cards}
				deletedNoteName={this.options.deletedNoteName}
				allNotes={this.allNotes}
				onResolve={(result) => this.resolve(result)}
				onCreateNote={() => void this.handleCreateNote()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}

	private async handleCreateNote(): Promise<void> {
		const folderPath = this.app.fileManager.getNewFileParent("")?.path ?? "";
		const baseName = `Recovered - ${this.options.deletedNoteName}`;

		let filePath = normalizePath(`${folderPath}/${baseName}.md`);
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			filePath = normalizePath(`${folderPath}/${baseName} ${counter}.md`);
			counter++;
		}

		this.resolve({
			cancelled: false,
			action: "create_note",
			newNotePath: filePath,
		});
	}
}
