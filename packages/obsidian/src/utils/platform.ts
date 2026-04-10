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
