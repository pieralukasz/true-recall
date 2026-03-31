import { jsx as _jsx } from "preact/jsx-runtime";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
import { ChangeNoteTypeBody } from "./change-note-type/ChangeNoteTypeBody";
export class ChangeNoteTypeModal extends BasePromiseModal {
    constructor(app, options) {
        super(app, {
            title: options.noteCount === 1
                ? "Change note type"
                : `Change note type (${options.noteCount} notes)`,
            width: "480px",
        });
        this.options = options;
    }
    getDefaultResult() {
        return { cancelled: true };
    }
    renderBody(container) {
        render(_jsx(ChangeNoteTypeBody, { currentNoteType: this.options.currentNoteType, availableNoteTypes: this.options.availableNoteTypes, onResolve: (result) => this.resolve(result) }), container);
    }
}
