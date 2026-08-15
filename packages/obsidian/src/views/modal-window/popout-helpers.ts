/**
 * Shared helpers for True Recall popout window views. Each popout view should
 * call `centerPopoutWindow` once after mount so the OS window opens visually
 * centered on the screen instead of in Electron's default top-left corner.
 *
 * `screen` can be missing in non-browser test environments (e.g. JSDOM),
 * which is why both helpers guard for it explicitly.
 *
 * A note on geometry, because it has bitten this file twice: the renderer's
 * `outerWidth`/`outerHeight` and the origin `resizeTo()` writes back are cached
 * values that lag the real window by frames. Reading them right after a resize
 * yields the previous size, and `resizeTo()` re-applies the stale origin, which
 * teleports a window that was just moved. Where Electron's BrowserWindow is
 * reachable, go through it instead — `getBounds`/`setBounds` are authoritative
 * and set position and size in one atomic call.
 */

import { computeCenteredPosition } from "./popout-fit";

export interface PopoutBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The slice of Electron's BrowserWindow this module needs. */
interface PopoutBrowserWindow {
	getBounds(): PopoutBounds;
	setBounds(bounds: Partial<PopoutBounds>): void;
	setMinimumSize(width: number, height: number): void;
	setMaximumSize(width: number, height: number): void;
}

interface ElectronModule {
	remote?: { getCurrentWindow?: () => unknown };
}

/**
 * Electron's BrowserWindow for this popout, or `null` when the remote module
 * is not reachable (no contract guarantees it — every caller must cope).
 */
export function getPopoutBrowserWindow(
	win: Window,
): PopoutBrowserWindow | null {
	try {
		const req = (win as Window & { require?: (id: string) => unknown }).require;
		if (typeof req !== "function") return null;
		const electron = req("electron") as ElectronModule;
		const candidate = electron.remote?.getCurrentWindow?.() as
			| Partial<PopoutBrowserWindow>
			| undefined;
		if (!candidate) return null;
		if (
			typeof candidate.getBounds !== "function" ||
			typeof candidate.setBounds !== "function" ||
			typeof candidate.setMinimumSize !== "function" ||
			typeof candidate.setMaximumSize !== "function"
		) {
			return null;
		}
		return candidate as PopoutBrowserWindow;
	} catch (err) {
		console.warn("[true-recall] popout: BrowserWindow unreachable", err);
		return null;
	}
}

/** Current window height in screen px, preferring the authoritative source. */
export function getPopoutOuterHeight(win: Window): number {
	return getPopoutBrowserWindow(win)?.getBounds().height ?? win.outerHeight;
}

/**
 * Takes the window off the user's resize handles, where Electron allows it.
 *
 * Deliberately NOT `setResizable(false)`: on macOS that disables the zoom
 * traffic light, which then renders as an unfilled circle that reads as a
 * black hole on the dark drag bar. Pinning the width via size constraints
 * keeps all three buttons coloured; stray height changes (drags, zoom) are
 * re-fitted by the caller's resize guard.
 */
const UNBOUNDED_HEIGHT = 100_000;

export function lockPopoutResize(win: Window): void {
	const bw = getPopoutBrowserWindow(win);
	if (!bw) return;
	const { width } = bw.getBounds();
	bw.setMinimumSize(width, 0);
	bw.setMaximumSize(width, UNBOUNDED_HEIGHT);
}

/**
 * Centres the window. Pass `size` when calling right after a resize — reading
 * it back off the window can still yield the pre-resize size on that frame.
 */
export function centerPopoutWindow(
	win: Window,
	size?: { width: number; height: number },
): void {
	const position = centeredPositionFor(
		win,
		size?.width ?? win.outerWidth,
		size?.height ?? win.outerHeight,
	);
	if (!position) return;
	win.moveTo(position.left, position.top);
}

/**
 * Resizes the popout to `height` (screen px), optionally re-centring it in the
 * same operation so the window never lands on an intermediate position.
 */
export function applyPopoutHeight(
	win: Window,
	height: number,
	options: { center: boolean },
): void {
	const bw = getPopoutBrowserWindow(win);
	if (!bw) {
		// Fallback path: two calls, and `resizeTo` may drag the stale origin
		// along. Centring last at least leaves the position correct.
		win.resizeTo(win.outerWidth, height);
		if (options.center) {
			centerPopoutWindow(win, { width: win.outerWidth, height });
		}
		return;
	}

	const { x, y, width } = bw.getBounds();
	if (!options.center) {
		bw.setBounds({ x, y, width, height });
		return;
	}

	const position = centeredPositionFor(win, width, height);
	bw.setBounds({
		x: position?.left ?? x,
		y: position?.top ?? y,
		width,
		height,
	});
}

function centeredPositionFor(
	win: Window,
	width: number,
	height: number,
): { left: number; top: number } | null {
	const screen = win.screen;
	if (!screen) return null;
	// availLeft/availTop are non-standard (multi-monitor offsets), missing
	// from lib.dom typings but supported in Chromium/Electron.
	const extScreen = screen as Screen & {
		availLeft?: number;
		availTop?: number;
	};
	return computeCenteredPosition({
		outerWidth: width,
		outerHeight: height,
		availLeft: extScreen.availLeft ?? 0,
		availTop: extScreen.availTop ?? 0,
		availWidth: screen.availWidth ?? width,
		availHeight: screen.availHeight ?? height,
	});
}

export function getPopoutWindowFromContainer(
	containerEl: HTMLElement & { win?: Window },
): Window | null {
	const win = containerEl.win;
	if (!win || win === window) return null;
	return win;
}
