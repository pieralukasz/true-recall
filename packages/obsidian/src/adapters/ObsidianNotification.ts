import type { INotification } from "@true-recall/core";
import { Notice } from "obsidian";

export class ObsidianNotification implements INotification {
	show(message: string, timeout?: number): void {
		new Notice(message, timeout);
	}

	error(message: string): void {
		new Notice(message, 10_000);
	}
}
