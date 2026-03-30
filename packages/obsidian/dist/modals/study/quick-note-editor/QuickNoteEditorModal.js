import { jsx as _jsx } from "preact/jsx-runtime";
import { ErrorBoundary } from "@true-recall/obsidian/components/ErrorBoundary";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
import { QuickNoteEditorApp } from "./QuickNoteEditorApp";
export class QuickNoteEditorModal extends BasePromiseModal {
    constructor(app, plugin, editorMode) {
        super(app, {
            title: editorMode.mode === "add" ? "Add Flashcard" : "Edit Flashcard",
            width: "660px",
        });
        this.plugin = plugin;
        this.editorMode = editorMode;
        this._hasContent = false;
        this._closeConfirmed = false;
    }
    getDefaultResult() {
        return { cancelled: true };
    }
    close() {
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
    renderBody(container) {
        render(_jsx(ObsidianProvider, { value: { app: this.app, plugin: this.plugin }, children: _jsx(ErrorBoundary, { children: _jsx(QuickNoteEditorApp, { mode: this.editorMode, onDone: (result) => this.resolve(result), onRequestClose: () => this.close(), onContentChange: (has) => {
                        this._hasContent = has;
                    } }) }) }), container);
    }
}
