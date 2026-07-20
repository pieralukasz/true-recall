import { describe, expect, it } from "vitest";

import {
	AI_PANEL_GAP,
	AI_PANEL_WIDTH,
	resolveFlyoutPlacement,
} from "../../src/features/assistant/ui/flyout-placement";

const NEEDED = AI_PANEL_WIDTH + AI_PANEL_GAP;

describe("resolveFlyoutPlacement", () => {
	it("uses the drawer outside popout windows (mobile modal host)", () => {
		expect(
			resolveFlyoutPlacement({ isPopout: false, spaceRightPx: 10_000 }),
		).toBe("drawer");
	});

	it("flies out right when the screen has room", () => {
		expect(
			resolveFlyoutPlacement({ isPopout: true, spaceRightPx: NEEDED }),
		).toBe("right");
		expect(
			resolveFlyoutPlacement({ isPopout: true, spaceRightPx: NEEDED + 500 }),
		).toBe("right");
	});

	it("falls back to the drawer when space is missing", () => {
		expect(
			resolveFlyoutPlacement({ isPopout: true, spaceRightPx: NEEDED - 1 }),
		).toBe("drawer");
		expect(resolveFlyoutPlacement({ isPopout: true, spaceRightPx: 0 })).toBe(
			"drawer",
		);
		expect(resolveFlyoutPlacement({ isPopout: true, spaceRightPx: -50 })).toBe(
			"drawer",
		);
	});
});
