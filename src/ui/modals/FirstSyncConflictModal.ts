/**
 * First Sync Conflict Modal
 * Shows when first sync detects data on both local and server
 * User must choose: Upload (local→server) or Download (server→local)
 */
import { App, ButtonComponent } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export type FirstSyncChoice = "upload" | "download" | "cancel";

export interface FirstSyncConflictResult {
	cancelled: boolean;
	choice: FirstSyncChoice;
}

/**
 * Modal for first sync conflict resolution (Anki-style)
 */
export class FirstSyncConflictModal extends BasePromiseModal<FirstSyncConflictResult> {
	constructor(app: App) {
		super(app, {
			title: "First Sync Conflict",
			width: "450px",
		});
	}

	protected getDefaultResult(): FirstSyncConflictResult {
		return { cancelled: true, choice: "cancel" };
	}

	protected renderBody(container: HTMLElement): void {
		// Warning message
		const warningEl = container.createDiv({ cls: "first-sync-warning" });
		warningEl.createEl("p", {
			text: "This device has never been synced before, but there is data both locally and on the server.",
		});
		warningEl.createEl("p", {
			text: "You must choose which data to keep. The other will be permanently lost.",
			cls: "mod-warning",
		});

		// Options
		const optionsEl = container.createDiv({ cls: "first-sync-options" });

		// Upload option
		const uploadOption = optionsEl.createDiv({ cls: "first-sync-option" });
		uploadOption.createEl("h4", { text: "Upload to Server" });
		uploadOption.createEl("p", {
			text: "Replace server data with your local flashcards. Use this if your local data is more complete.",
		});
		new ButtonComponent(uploadOption)
			.setButtonText("Upload Local → Server")
			.setWarning()
			.onClick(() => {
				this.resolve({ cancelled: false, choice: "upload" });
			});

		// Download option
		const downloadOption = optionsEl.createDiv({ cls: "first-sync-option" });
		downloadOption.createEl("h4", { text: "Download from Server" });
		downloadOption.createEl("p", {
			text: "Replace local data with server flashcards. Use this if another device has your main data.",
		});
		new ButtonComponent(downloadOption)
			.setButtonText("Download Server → Local")
			.setWarning()
			.onClick(() => {
				this.resolve({ cancelled: false, choice: "download" });
			});

		// Cancel
		const cancelEl = container.createDiv({ cls: "first-sync-cancel" });
		new ButtonComponent(cancelEl).setButtonText("Cancel").onClick(() => {
			this.resolve({ cancelled: true, choice: "cancel" });
		});
	}
}
