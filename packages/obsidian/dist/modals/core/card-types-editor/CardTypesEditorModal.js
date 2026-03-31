import { jsx as _jsx } from "preact/jsx-runtime";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
import { CardTypesEditorApp } from "./CardTypesEditorApp";
export class CardTypesEditorModal extends BaseModal {
    constructor(app, plugin, noteTypeId) {
        var _a;
        const noteType = plugin.noteTypeService.getById(noteTypeId);
        super(app, {
            title: `Card Types for "${(_a = noteType === null || noteType === void 0 ? void 0 : noteType.name) !== null && _a !== void 0 ? _a : "Unknown"}"`,
            width: "1100px",
        });
        this.plugin = plugin;
        this.noteTypeId = noteTypeId;
    }
    renderBody(container) {
        render(_jsx(ObsidianProvider, { value: { app: this.app, plugin: this.plugin }, children: _jsx(CardTypesEditorApp, { noteTypeId: this.noteTypeId, onClose: () => this.close(), onTitleChange: (title) => this.updateTitle(title) }) }), container);
    }
}
