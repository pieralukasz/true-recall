import { type App, Modal, Platform } from "obsidian";

const SHORTCUTS: { keys: string; label: string }[] = [
	{ keys: "MOD F", label: "Focus Search" },
	{ keys: "/", label: "Focus Search" },
	{ keys: "N", label: "Add Card" },
	{ keys: "MOD A", label: "Select Visible Cards" },
	{ keys: "E", label: "Edit Open Card" },
	{ keys: "J / ↓", label: "Next Card" },
	{ keys: "K / ↑", label: "Previous Card" },
	{ keys: "Esc", label: "Go Back or Exit Selection" },
	{ keys: "?", label: "Show Keyboard Shortcuts" },
];

class PanelShortcutsModal extends Modal {
	onOpen(): void {
		this.setTitle("Card Panel Shortcuts");
		this.modalEl.addClass("tr-modal-panel-shortcuts");
		const modifier = Platform.isMacOS ? "⌘" : "Ctrl";
		const list = this.contentEl.createDiv({ cls: "tr-panel-shortcuts-list" });

		for (const shortcut of SHORTCUTS) {
			const row = list.createDiv({ cls: "tr-panel-shortcuts-row" });
			row.createSpan({ text: shortcut.label });
			const keys = row.createDiv({ cls: "tr-panel-shortcut-keys" });
			for (const key of shortcut.keys.replace("MOD", modifier).split(" ")) {
				keys.createEl("kbd", { text: key });
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function openPanelShortcutsModal(app: App): void {
	new PanelShortcutsModal(app).open();
}
