import type { NoteType } from "@shared/types/note.types";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import type { App } from "obsidian";
import { render } from "preact";
import { ChangeNoteTypeBody } from "./change-note-type/ChangeNoteTypeBody";

export interface ChangeNoteTypeResult {
	cancelled: boolean;
	targetNoteTypeId?: string;
	/** newFieldName → oldFieldName */
	fieldMapping?: Record<string, string>;
}

export interface ChangeNoteTypeModalOptions {
	currentNoteType: NoteType;
	availableNoteTypes: NoteType[];
	noteCount: number;
}

export class ChangeNoteTypeModal extends BasePromiseModal<ChangeNoteTypeResult> {
	private options: ChangeNoteTypeModalOptions;

	constructor(app: App, options: ChangeNoteTypeModalOptions) {
		super(app, {
			title:
				options.noteCount === 1
					? "Change note type"
					: `Change note type (${options.noteCount} notes)`,
			width: "480px",
		});
		this.options = options;
	}

	protected getDefaultResult(): ChangeNoteTypeResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ChangeNoteTypeBody
				currentNoteType={this.options.currentNoteType}
				availableNoteTypes={this.options.availableNoteTypes}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
	}
}
