import { jsx as _jsx } from "preact/jsx-runtime";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
import { ImportStudioApp } from "./ImportStudioApp";
export class ImportStudioModal extends BaseModal {
    constructor(app, plugin, options) {
        super(app, {
            title: "Import Flashcards",
            width: "720px",
        });
        this.plugin = plugin;
        this.options = options;
    }
    renderBody(container) {
        var _a;
        render(_jsx(ObsidianProvider, { value: { app: this.app, plugin: this.plugin }, children: _jsx(ImportStudioApp, { onClose: () => this.close(), defaultNoteTypeId: (_a = this.options) === null || _a === void 0 ? void 0 : _a.defaultNoteTypeId }) }), container);
    }
}
