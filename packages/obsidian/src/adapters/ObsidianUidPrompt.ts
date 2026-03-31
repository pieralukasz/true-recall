import type {
	IUidRemovalPrompt,
	UidChangeEvent,
	UidRemovalAction,
} from "@true-recall/core";
import { UidRemovedModal } from "@true-recall/obsidian/modals/study/UidRemovedModal";
import type { App } from "obsidian";

export class ObsidianUidPrompt implements IUidRemovalPrompt {
	constructor(private app: App) {}

	async onUidRemoved(event: UidChangeEvent): Promise<UidRemovalAction> {
		const modal = new UidRemovedModal(this.app, {
			fileName: event.fileName,
			removedUid: event.removedUid,
			cardCount: event.cardCount,
		});

		const result = await modal.openAndWait();

		if (result.cancelled) {
			return { action: "cancelled" };
		}

		switch (result.action) {
			case "restore":
				return { action: "restore" };
			case "delete":
				return { action: "delete" };
			case "move":
				return {
					action: "move",
					targetNotePath: result.targetNotePath ?? "",
				};
			default:
				return { action: "cancelled" };
		}
	}
}
