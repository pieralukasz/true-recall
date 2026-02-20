import type { App } from "obsidian";
import { render } from "preact";
import { BaseModal } from "@shared/ui/modals/BaseModal";

const KEYBOARD_SHORTCUTS = [
	{ key: "Ctrl+Enter", action: "Save and close" },
	{ key: "Escape", action: "Cancel" },
	{ key: "Tab", action: "Switch between Question/Answer" },
	{ key: "Ctrl+B", action: "Bold (**text**)" },
	{ key: "Ctrl+I", action: "Italic (*text*)" },
	{ key: "Ctrl+K", action: "Wiki link ([[link]])" },
	{ key: "Ctrl+M", action: "Math ($$formula$$)" },
	{ key: "Ctrl+L", action: "List item (- )" },
	{ key: "Ctrl+Shift+C", action: "Code block (```code```)" },
	{ key: "Ctrl+Shift+I", action: "Insert media (image/video)" },
	{ key: "Ctrl+V", action: "Paste (images auto-saved)" },
	{ key: "Ctrl+/", action: "Show this help" },
];

function KeyboardShortcutsBody() {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			{KEYBOARD_SHORTCUTS.map((shortcut) => (
				<div
					key={shortcut.key}
					class="ep:flex ep:justify-between ep:items-center ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded-md"
				>
					<span class="ep:py-1 ep:px-2 ep:bg-obs-border ep:rounded ep:font-mono ep:text-ui-smaller ep:font-medium ep:text-obs-normal">
						{shortcut.key}
					</span>
					<span class="ep:text-ui-small ep:text-obs-normal">
						{shortcut.action}
					</span>
				</div>
			))}
		</div>
	);
}

export class KeyboardShortcutsModal extends BaseModal {
	private unmountBody?: () => void;

	constructor(app: App) {
		super(app, {
			title: "Keyboard Shortcuts",
			width: "500px",
		});
	}

	protected renderBody(container: HTMLElement): void {
		render(<KeyboardShortcutsBody />, container);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
