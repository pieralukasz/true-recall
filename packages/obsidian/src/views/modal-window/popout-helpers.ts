/**
 * Shared helpers for True Recall popout window views. Each popout view should
 * call `centerPopoutWindow` once after mount so the OS window opens visually
 * centered on the screen instead of in Electron's default top-left corner.
 *
 * `screen` can be missing in non-browser test environments (e.g. JSDOM),
 * which is why both helpers guard for it explicitly.
 */

export function centerPopoutWindow(win: Window): void {
	const screen = win.screen;
	if (!screen) return;
	// availLeft/availTop are non-standard (multi-monitor offsets), missing
	// from lib.dom typings but supported in Chromium/Electron.
	const extScreen = screen as Screen & {
		availLeft?: number;
		availTop?: number;
	};
	const availLeft = extScreen.availLeft ?? 0;
	const availTop = extScreen.availTop ?? 0;
	const availWidth = screen.availWidth ?? win.outerWidth;
	const availHeight = screen.availHeight ?? win.outerHeight;
	const w = win.outerWidth;
	const h = win.outerHeight;
	const left = availLeft + Math.max(0, Math.round((availWidth - w) / 2));
	const top = availTop + Math.max(0, Math.round((availHeight - h) / 2));
	win.moveTo(left, top);
}

export function getPopoutWindowFromContainer(
	containerEl: HTMLElement & { win?: Window },
): Window | null {
	const win = containerEl.win;
	if (!win || win === window) return null;
	return win;
}
