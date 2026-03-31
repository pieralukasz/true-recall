import { jsx as _jsx } from "preact/jsx-runtime";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { render } from "preact";
import { NoteTypeManagerApp } from "./note-type-manager/NoteTypeManagerApp";
export class NoteTypeManagerModal extends BaseModal {
    constructor(app, plugin) {
        super(app, {
            title: "Manage Note Types",
            width: "860px",
        });
        this.plugin = plugin;
    }
    renderBody(container) {
        render(_jsx(ObsidianProvider, { value: { app: this.app, plugin: this.plugin }, children: _jsx(NoteTypeManagerApp, { onClose: () => this.close() }) }), container);
    }
}
