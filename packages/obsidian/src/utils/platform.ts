import { Platform } from "obsidian";

import {
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_REVIEW,
} from "@true-recall/core/constants";

const MOBILE_ALLOWED_VIEWS = new Set([VIEW_TYPE_REVIEW, VIEW_TYPE_DASHBOARD]);

export function isMobile(): boolean {
	return Platform.isMobile;
}

export function isDesktop(): boolean {
	return !Platform.isMobile;
}

export function isViewAllowedOnCurrentPlatform(viewType: string): boolean {
	return isDesktop() || MOBILE_ALLOWED_VIEWS.has(viewType);
}

/**
 * Check if the plugin can modify data (add/edit/delete cards, do reviews)
 *
 * Rules:
 * - Desktop: Always can modify data (works standalone)
 * - Mobile: Can only modify data if sync is enabled
 *
 * This prevents data loss from file sync conflicts when mobile modifies
 * data without proper server-side sync.
 *
 * @param syncEnabled - Whether the sync server is configured and enabled
 */
function canModifyData(syncEnabled: boolean): boolean {
	// Desktop: always can modify
	// Mobile: only if sync is enabled
	return isDesktop() || syncEnabled;
}
