import { Platform } from "obsidian";
import { afterEach, describe, expect, it } from "vitest";

import {
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";

import {
	capabilities,
	isViewAllowedOnCurrentPlatform,
} from "@true-recall/obsidian/utils/platform";

const mutablePlatform = Platform as unknown as {
	isMobile: boolean;
	isPhone: boolean;
	isTablet: boolean;
};

function setPlatform(kind: "desktop" | "phone" | "tablet"): void {
	mutablePlatform.isMobile = kind !== "desktop";
	mutablePlatform.isPhone = kind === "phone";
	mutablePlatform.isTablet = kind === "tablet";
}

afterEach(() => {
	setPlatform("desktop");
});

describe("isViewAllowedOnCurrentPlatform", () => {
	it("allows every view on desktop", () => {
		setPlatform("desktop");
		for (const view of [
			VIEW_TYPE_REVIEW,
			VIEW_TYPE_DASHBOARD,
			VIEW_TYPE_FLASHCARD_PANEL,
			VIEW_TYPE_STATS,
			VIEW_TYPE_CARD_BROWSER,
			VIEW_TYPE_SIMULATOR,
		]) {
			expect(isViewAllowedOnCurrentPlatform(view)).toBe(true);
		}
	});

	it("allows the core-loop views on mobile", () => {
		setPlatform("phone");
		expect(isViewAllowedOnCurrentPlatform(VIEW_TYPE_REVIEW)).toBe(true);
		expect(isViewAllowedOnCurrentPlatform(VIEW_TYPE_DASHBOARD)).toBe(true);
		expect(isViewAllowedOnCurrentPlatform(VIEW_TYPE_FLASHCARD_PANEL)).toBe(
			true,
		);
		expect(isViewAllowedOnCurrentPlatform(VIEW_TYPE_STATS)).toBe(true);
	});

	it("blocks desktop-only views on mobile", () => {
		setPlatform("phone");
		expect(isViewAllowedOnCurrentPlatform(VIEW_TYPE_CARD_BROWSER)).toBe(false);
		expect(isViewAllowedOnCurrentPlatform(VIEW_TYPE_SIMULATOR)).toBe(false);
	});
});

describe("capabilities", () => {
	it.each([
		["canOpenPopout", capabilities.canOpenPopout],
		["canRunLocalApi", capabilities.canRunLocalApi],
		["canEditImageOcclusion", capabilities.canEditImageOcclusion],
		["canUseCardBrowser", capabilities.canUseCardBrowser],
		["canUseStreamingFetch", capabilities.canUseStreamingFetch],
	] as const)("%s is desktop-only", (_name, check) => {
		setPlatform("desktop");
		expect(check()).toBe(true);
		setPlatform("phone");
		expect(check()).toBe(false);
		setPlatform("tablet");
		expect(check()).toBe(false);
	});

	it("canShowFullStats excludes only phones", () => {
		setPlatform("desktop");
		expect(capabilities.canShowFullStats()).toBe(true);
		setPlatform("tablet");
		expect(capabilities.canShowFullStats()).toBe(true);
		setPlatform("phone");
		expect(capabilities.canShowFullStats()).toBe(false);
	});
});
