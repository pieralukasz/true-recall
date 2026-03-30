import { Notice } from "obsidian";
export class ObsidianNotification {
    show(message, timeout) {
        new Notice(message, timeout);
    }
    error(message) {
        new Notice(message, 10000);
    }
}
