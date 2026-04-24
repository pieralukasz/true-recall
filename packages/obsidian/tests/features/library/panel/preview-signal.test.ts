import { describe, expect, it } from "vitest";

import {
	clearPreviewingCard,
	previewingCardIdSignal,
	setPreviewingCard,
	viewTransitionNameForCard,
} from "@true-recall/obsidian/features/library/ui/panel/preview/preview-signal";

describe("preview-signal", () => {
	it("starts as null", () => {
		clearPreviewingCard();
		expect(previewingCardIdSignal.value).toBeNull();
	});

	it("setPreviewingCard sets the id", () => {
		setPreviewingCard("card-1");
		expect(previewingCardIdSignal.value).toBe("card-1");
		clearPreviewingCard();
	});

	it("clearPreviewingCard resets to null", () => {
		setPreviewingCard("card-1");
		clearPreviewingCard();
		expect(previewingCardIdSignal.value).toBeNull();
	});

	it("viewTransitionNameForCard returns shared name for the active card only", () => {
		setPreviewingCard("card-1");
		expect(viewTransitionNameForCard("card-1")).toBe("tr-card-preview");
		expect(viewTransitionNameForCard("card-2")).toBeUndefined();
		clearPreviewingCard();
		expect(viewTransitionNameForCard("card-1")).toBeUndefined();
	});
});
