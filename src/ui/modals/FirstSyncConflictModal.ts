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
		const warningEl = container.createDiv({ cls: "ep:mb-4" });
		const p1 = warningEl.createEl("p", {
			text: "This device has never been synced before, but there is data both locally and on the server.",
		});
		p1.addClass("ep:m-0", "ep:mb-2", "ep:leading-normal");
		const p2 = warningEl.createEl("p", {
			text: "You must choose which data to keep. The other will be permanently lost.",
			cls: "mod-warning",
		});
		p2.addClass("ep:m-0", "ep:leading-normal", "ep:text-obs-warning", "ep:font-medium");

		// Options
		const optionsEl = container.createDiv({ cls: "ep:flex ep:flex-col ep:gap-4 ep:mb-4" });

		// Upload option
		const uploadOption = optionsEl.createDiv({ cls: "ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-lg" });
		const h4Upload = uploadOption.createEl("h4", { text: "Upload to Server" });
		h4Upload.addClass("ep:m-0", "ep:mb-2", "ep:text-sm", "ep:font-semibold");
		const pUpload = uploadOption.createEl("p", {
			text: "Replace server data with your local flashcards. Use this if your local data is more complete.",
		});
		pUpload.addClass("ep:m-0", "ep:mb-3", "ep:text-sm", "ep:text-obs-muted", "ep:leading-snug");
		new ButtonComponent(uploadOption)
			.setButtonText("Upload Local → Server")
			.setWarning()
			.onClick(() => {
				this.resolve({ cancelled: false, choice: "upload" });
			});

		// Download option
		const downloadOption = optionsEl.createDiv({ cls: "ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-lg" });
		const h4Download = downloadOption.createEl("h4", { text: "Download from Server" });
		h4Download.addClass("ep:m-0", "ep:mb-2", "ep:text-sm", "ep:font-semibold");
		const pDownload = downloadOption.createEl("p", {
			text: "Replace local data with server flashcards. Use this if another device has your main data.",
		});
		pDownload.addClass("ep:m-0", "ep:mb-3", "ep:text-sm", "ep:text-obs-muted", "ep:leading-snug");
		new ButtonComponent(downloadOption)
			.setButtonText("Download Server → Local")
			.setWarning()
			.onClick(() => {
				this.resolve({ cancelled: false, choice: "download" });
			});

		// Cancel
		const cancelEl = container.createDiv({ cls: "ep:flex ep:justify-center ep:pt-2 ep:border-t ep:border-obs-border" });
		new ButtonComponent(cancelEl).setButtonText("Cancel").onClick(() => {
			this.resolve({ cancelled: true, choice: "cancel" });
		});
	}
}
