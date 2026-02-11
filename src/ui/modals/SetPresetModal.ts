import { App } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface SetPresetResult {
	cancelled: boolean;
	presetName: string | null;
}

export class SetPresetModal extends BasePromiseModal<SetPresetResult> {
	private presetNames: string[];
	private currentPreset: string | null;

	constructor(app: App, presetNames: string[], currentPreset: string | null) {
		super(app, {
			title: "Set FSRS preset",
			width: "360px",
		});
		this.presetNames = presetNames;
		this.currentPreset = currentPreset;
	}

	protected getDefaultResult(): SetPresetResult {
		return { cancelled: true, presetName: null };
	}

	protected renderBody(container: HTMLElement): void {
		const listEl = this.createListContainer(container, "240px");

		// "Default (remove override)" option
		const defaultItem = listEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:cursor-pointer ep:rounded-md hover:ep:bg-interactive-hover" });
		defaultItem.createSpan({ text: "Default (remove override)", cls: "ep:text-ui-small" });
		if (!this.currentPreset) {
			defaultItem.createSpan({ text: " (current)", cls: "ep:text-ui-small ep:opacity-50" });
		}
		defaultItem.addEventListener("click", () => {
			this.resolve({ cancelled: false, presetName: null });
		});

		// Preset options
		for (const name of this.presetNames) {
			if (name === "Default") continue;
			const item = listEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:cursor-pointer ep:rounded-md hover:ep:bg-interactive-hover" });
			item.createSpan({ text: name, cls: "ep:text-ui-small" });
			if (name === this.currentPreset) {
				item.createSpan({ text: " (current)", cls: "ep:text-ui-small ep:opacity-50" });
			}
			item.addEventListener("click", () => {
				this.resolve({ cancelled: false, presetName: name });
			});
		}

		this.createButtonsSection(container, [
			{
				text: "Cancel",
				type: "secondary",
				onClick: () => this.resolve({ cancelled: true, presetName: null }),
			},
		]);
	}
}
