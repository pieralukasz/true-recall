import { Notice } from "obsidian";

import { reportError } from "../errors";

export const NOTIFICATION_DURATION = {
	SHORT: 3000,
	NORMAL: 5000,
	LONG: 8000,
	PERSIST: 0,
} as const;

/** Generic UI adapter. Domain-specific wording belongs in NotificationService. */
export class NoticeService {
	success(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.SHORT);
	}

	error(message: string, error?: unknown, duration?: number): void {
		if (error) reportError(error, { origin: "notification" });
		new Notice(message, duration ?? NOTIFICATION_DURATION.LONG);
	}

	warning(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.NORMAL);
	}

	info(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.NORMAL);
	}
}
