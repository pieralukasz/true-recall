// Obsidian plugins always run inside a browser-like renderer, so production
// code freely uses `window.setTimeout`/`window.setInterval` for popout-window
// compatibility. Vitest's Node environment has no `window` — alias it to
// globalThis so those calls resolve exactly like their bare Node equivalents.
if (typeof globalThis.window === "undefined") {
	(globalThis as typeof globalThis & { window: typeof globalThis }).window =
		globalThis;
}
