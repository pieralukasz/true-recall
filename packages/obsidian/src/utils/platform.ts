import { Platform } from "obsidian";

import {
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";

const MOBILE_ALLOWED_VIEWS = new Set([
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_STATS,
]);

export function isMobile(): boolean {
	return Platform.isMobile;
}

export function isDesktop(): boolean {
	return !Platform.isMobile;
}

export function isPhone(): boolean {
	return Platform.isPhone;
}

export function isTablet(): boolean {
	return Platform.isTablet;
}

export function isViewAllowedOnCurrentPlatform(viewType: string): boolean {
	return isDesktop() || MOBILE_ALLOWED_VIEWS.has(viewType);
}

/**
 * Central capability matrix. All platform gating should flow through these
 * checks instead of ad-hoc Platform reads, so each capability has a single
 * source of truth and call sites explain intent, not mechanism.
 */
export const capabilities = {
	/** Electron OS popout windows; without them editors fall back to modals. */
	canOpenPopout: (): boolean => isDesktop(),
	/** Node http server bound via Electron's window.require. */
	canRunLocalApi: (): boolean => isDesktop(),
	/** Image occlusion editor needs precise pointer interactions and canvas sizing. */
	canEditImageOcclusion: (): boolean => isDesktop(),
	/** Full stats charts; phones get the simplified layout. */
	canShowFullStats: (): boolean => !Platform.isPhone,
	/** Desktop card browser table (dense grid, keyboard navigation). */
	canUseCardBrowser: (): boolean => isDesktop(),
	/**
	 * Streaming AI responses need native window.fetch with ReadableStream;
	 * mobile WebViews are subject to CORS, so callers must fall back to
	 * Obsidian's requestUrl (non-streaming).
	 */
	canUseStreamingFetch: (): boolean => isDesktop(),
};
