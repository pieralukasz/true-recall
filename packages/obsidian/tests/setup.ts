// Obsidian plugins always run inside a browser-like renderer, so production
// code freely uses `window.setTimeout`/`window.setInterval` for popout-window
// compatibility. Vitest's Node environment has no `window` — alias it to
// globalThis so those calls resolve exactly like their bare Node equivalents.
if (typeof globalThis.window === "undefined") {
	(globalThis as typeof globalThis & { window: typeof globalThis }).window =
		globalThis;
}

// Obsidian also provides `activeDocument`/`activeWindow` globals (the
// focused window's document/window, for popout-window compatibility).
// Tests that care about a specific value stub it themselves via
// vi.stubGlobal — this is just a default so registration code that reads
// it doesn't throw ReferenceError before a test gets the chance to stub it.
if (typeof globalThis.activeDocument === "undefined") {
	(
		globalThis as typeof globalThis & { activeDocument: typeof globalThis }
	).activeDocument = globalThis;
}
if (typeof globalThis.activeWindow === "undefined") {
	(
		globalThis as typeof globalThis & { activeWindow: typeof globalThis }
	).activeWindow = globalThis;
}
