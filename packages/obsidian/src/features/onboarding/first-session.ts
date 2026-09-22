import { Modal, Setting } from "obsidian";

import { notify } from "@true-recall/obsidian/services/notification.service";

import type TrueRecallPlugin from "../../main";
import { openStarterMaterial } from "./starter-material";

export class FirstSessionModal extends Modal {
	constructor(private readonly plugin: TrueRecallPlugin) {
		super(plugin.app);
	}
	onOpen(): void {
		this.titleEl.setText("Your first True Recall session");
		const content = this.contentEl;
		content.createEl("p", {
			text: "Try a small set of cards, test yourself, then return tomorrow. Progress stays on this device.",
		});
		const tasks: Array<[string, string]> = [
			[
				"1. Prepare a few cards",
				"Open the practice note (or use your own). Select one paragraph, choose Ask AI and request 3–5 cards. Check each draft before applying it.",
			],
			[
				"2. Recall, then get feedback",
				"Review the cards. Turn on Typed answers in Settings → True Recall → General, then press T during review to try AI feedback.",
			],
			[
				"3. Try an image card",
				"The practice note includes a simple diagram. Use the Image Occlusion creation tool, cover a label, save a card and try recalling it.",
			],
			[
				"4. Return tomorrow",
				"Open the practice note tomorrow and review its due cards. Keep the session small and let the review schedule build a habit.",
			],
		];
		for (const [index, [title, description]] of tasks.entries()) {
			new Setting(content)
				.setName(title)
				.setDesc(description)
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.app.loadLocalStorage(
								`true-recall-first-session-${index}`,
							) === true,
						)
						.onChange((value) => {
							this.app.saveLocalStorage(
								`true-recall-first-session-${index}`,
								value,
							);
						}),
				);
		}
		new Setting(content)
			.addButton((button) =>
				button
					.setButtonText("Open practice note")
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						try {
							await openStarterMaterial(this.plugin);
							this.close();
						} catch (error) {
							notify().operationFailed("open practice note", error);
							button.setDisabled(false);
						}
					}),
			)
			.addButton((button) =>
				button.setButtonText("Review current note").onClick(() => {
					this.close();
					void this.plugin.reviewCurrentNote();
				}),
			);
		content.createEl("p", {
			text: "AI sends the material you choose to True Recall's provider. Starting this guide does not enable Cloud Sync. You can reopen it with the First learning session command.",
		});
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
