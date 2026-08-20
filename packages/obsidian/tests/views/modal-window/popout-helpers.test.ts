import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	applyPopoutHeight,
	getPopoutOuterHeight,
	lockPopoutResize,
	type PopoutBounds,
} from "@true-recall/obsidian/views/modal-window/popout-helpers";

interface Harness {
	win: Window;
	bounds: PopoutBounds;
	setBounds: ReturnType<typeof vi.fn>;
	setMinimumSize: ReturnType<typeof vi.fn>;
	setMaximumSize: ReturnType<typeof vi.fn>;
	resizeTo: ReturnType<typeof vi.fn>;
	moveTo: ReturnType<typeof vi.fn>;
}

// A 1512x950 usable area under a 32px menu bar, holding a 720x600 window whose
// renderer-side outerWidth/outerHeight are deliberately stale.
function harness(options: { withBrowserWindow: boolean }): Harness {
	const bounds: PopoutBounds = { x: 100, y: 60, width: 720, height: 600 };
	const setBounds = vi.fn((next: Partial<PopoutBounds>) =>
		Object.assign(bounds, next),
	);
	const setMinimumSize = vi.fn();
	const setMaximumSize = vi.fn();
	const resizeTo = vi.fn();
	const moveTo = vi.fn();

	const browserWindow = {
		getBounds: () => ({ ...bounds }),
		setBounds,
		setMinimumSize,
		setMaximumSize,
	};

	const win = {
		outerWidth: 720,
		outerHeight: 600,
		screen: {
			availLeft: 0,
			availTop: 32,
			availWidth: 1512,
			availHeight: 950,
		},
		resizeTo,
		moveTo,
		require: options.withBrowserWindow
			? () => ({ remote: { getCurrentWindow: () => browserWindow } })
			: undefined,
	} as unknown as Window;

	return {
		win,
		bounds,
		setBounds,
		setMinimumSize,
		setMaximumSize,
		resizeTo,
		moveTo,
	};
}

describe("popout-helpers", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("getPopoutOuterHeight", () => {
		it("prefers the BrowserWindow bounds over the stale renderer value", () => {
			const h = harness({ withBrowserWindow: true });
			h.bounds.height = 355;
			expect(getPopoutOuterHeight(h.win)).toBe(355);
		});

		it("falls back to outerHeight without a BrowserWindow", () => {
			const h = harness({ withBrowserWindow: false });
			expect(getPopoutOuterHeight(h.win)).toBe(600);
		});
	});

	describe("lockPopoutResize", () => {
		it("pins the width without disabling the macOS zoom button", () => {
			// Regression: setResizable(false) greys out the zoom traffic light,
			// which renders as a black hole on the dark drag bar.
			const h = harness({ withBrowserWindow: true });
			lockPopoutResize(h.win);
			expect(h.setMinimumSize).toHaveBeenCalledWith(720, 0);
			expect(h.setMaximumSize).toHaveBeenCalledWith(720, 100_000);
		});

		it("is a no-op without a BrowserWindow", () => {
			const h = harness({ withBrowserWindow: false });
			expect(() => lockPopoutResize(h.win)).not.toThrow();
		});
	});

	describe("applyPopoutHeight", () => {
		it("sets the centered position and the height in one call", () => {
			// Regression: resizing and moving separately let a second resize
			// re-apply the renderer's stale origin and undo the centering.
			const h = harness({ withBrowserWindow: true });
			applyPopoutHeight(h.win, 355, { center: true });
			expect(h.setBounds).toHaveBeenCalledTimes(1);
			expect(h.setBounds).toHaveBeenCalledWith({
				x: 396,
				y: 330,
				width: 720,
				height: 355,
			});
		});

		it("keeps the current position when not centering", () => {
			const h = harness({ withBrowserWindow: true });
			applyPopoutHeight(h.win, 475, { center: false });
			expect(h.setBounds).toHaveBeenCalledWith({
				x: 100,
				y: 60,
				width: 720,
				height: 475,
			});
		});

		it("centers on the requested height, not the stale one", () => {
			const h = harness({ withBrowserWindow: true });
			applyPopoutHeight(h.win, 355, { center: true });
			// Centering for the stale 600 would put the window at y=207.
			expect(h.setBounds.mock.calls[0]?.[0]).toMatchObject({ y: 330 });
		});

		it("falls back to resizeTo/moveTo without a BrowserWindow", () => {
			const h = harness({ withBrowserWindow: false });
			applyPopoutHeight(h.win, 355, { center: true });
			expect(h.resizeTo).toHaveBeenCalledWith(720, 355);
			expect(h.moveTo).toHaveBeenCalledWith(396, 330);
		});

		it("does not move the window on the fallback path when not centering", () => {
			const h = harness({ withBrowserWindow: false });
			applyPopoutHeight(h.win, 355, { center: false });
			expect(h.resizeTo).toHaveBeenCalledWith(720, 355);
			expect(h.moveTo).not.toHaveBeenCalled();
		});
	});
});
